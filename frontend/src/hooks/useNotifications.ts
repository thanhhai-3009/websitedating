import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs";
import { toast } from "@/hooks/use-toast";
import { getApiToken } from "@/lib/clerkToken";

export interface NotificationData {
  matchedUserId?: string;
  matchedUserName?: string;
  matchedUserAvatar?: string;
  roomId?: string;
  senderUserId?: string;
  senderName?: string;
  senderAvatar?: string;
  preview?: string;
  [key: string]: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  content: string;
  data: NotificationData;
  isRead: boolean;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const POLLING_MS = Number.parseInt(import.meta.env.VITE_NOTIFICATIONS_POLLING_MS || "10000", 10);
const shownToastKeys = new Set<string>();

const notificationIdentity = (value: AppNotification) =>
  value.id || `${value.userId}|${value.type}|${value.createdAt}|${value.content}`;

const mergeUniqueNotifications = (current: AppNotification[], incoming: AppNotification[]) => {
  const seen = new Set<string>();
  const merged: AppNotification[] = [];

  [...incoming, ...current].forEach((item) => {
    const key = notificationIdentity(item);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });

  return merged.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return tb - ta;
  });
};

const upsertNotification = (current: AppNotification[], incoming: AppNotification) => {
  const key = notificationIdentity(incoming);
  const replaced = current.map((item) => (notificationIdentity(item) === key ? incoming : item));
  const hasExisting = current.some((item) => notificationIdentity(item) === key);
  return mergeUniqueNotifications(hasExisting ? replaced : [incoming, ...current], []);
};

export function useNotifications() {
  const { userId, isLoaded, getToken } = useAuth();
  const queryClient = useQueryClient();
  const clientRef = useRef<Client | null>(null);

  const { data: unreadNotifications = [], isLoading: isLoadingUnread } = useQuery({
    queryKey: ["notifications", "unread", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/notifications/unread?clerkId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to fetch unread notifications");
      return res.json() as Promise<AppNotification[]>;
    },
    enabled: isLoaded && !!userId,
    refetchInterval: Number.isFinite(POLLING_MS) && POLLING_MS > 0 ? POLLING_MS : false,
  });

  const { data: allNotifications = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ["notifications", "all", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/notifications?clerkId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to fetch all notifications");
      return res.json() as Promise<AppNotification[]>;
    },
    enabled: isLoaded && !!userId,
  });

  useEffect(() => {
    if (!isLoaded || !userId) {
      return undefined;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 5000,
      debug: () => {},
      beforeConnect: async () => {
        const token = await getApiToken(getToken);
        if (!token) {
          throw new Error("Missing auth token");
        }
        client.connectHeaders = {
          Authorization: `Bearer ${token}`,
        };
      },
      onConnect: () => {
        client.subscribe("/user/queue/notifications", (frame) => {
          try {
            const incoming = JSON.parse(frame.body) as AppNotification;
            if (!incoming || !incoming.id) {
              return;
            }

            queryClient.setQueryData<AppNotification[]>(["notifications", "all", userId], (prev = []) =>
              upsertNotification(prev, incoming)
            );

            if (!incoming.isRead) {
              queryClient.setQueryData<AppNotification[]>(["notifications", "unread", userId], (prev = []) =>
                upsertNotification(prev, incoming)
              );
            }

            if (incoming.type === "new_message" && !incoming.isRead) {
              const toastKey = notificationIdentity(incoming);
              if (!shownToastKeys.has(toastKey)) {
                shownToastKeys.add(toastKey);
                const senderName = incoming.data?.senderName || "New message";
                const preview = incoming.data?.preview || incoming.content || "You received a new message";
                toast({
                  title: senderName,
                  description: preview,
                });
              }
            }

            // emit a global event for appointment updates so pages can react (e.g. refresh appointments list)
            if (incoming.type === "appointment_updated") {
              try {
                window.dispatchEvent(new CustomEvent("appointment-updated", { detail: incoming.data || {} }));
              } catch (e) {
                // ignore
              }
            }
          } catch {
            // Ignore malformed payload and let polling/backfill keep state consistent.
          }
        });

        // Backfill after reconnect to avoid missing notifications while offline.
        queryClient.invalidateQueries({ queryKey: ["notifications", "unread", userId] });
        queryClient.invalidateQueries({ queryKey: ["notifications", "all", userId] });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [getToken, isLoaded, queryClient, userId]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const res = await fetch(`/api/notifications/${notificationId}/read?clerkId=${encodeURIComponent(userId)}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onMutate: async (notificationId: string) => {
      if (!userId) return;

      queryClient.setQueryData<AppNotification[]>(["notifications", "all", userId], (prev = []) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification
        )
      );

      queryClient.setQueryData<AppNotification[]>(["notifications", "unread", userId], (prev = []) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    unreadNotifications,
    allNotifications,
    isLoadingUnread,
    isLoadingAll,
    markAsRead,
  };
}
