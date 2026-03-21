import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";

export interface NotificationData {
  matchedUserId?: string;
  matchedUserName?: string;
  matchedUserAvatar?: string;
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

export function useNotifications() {
  const { userId, isLoaded } = useAuth();
  const queryClient = useQueryClient();

  const { data: unreadNotifications = [], isLoading: isLoadingUnread } = useQuery({
    queryKey: ["notifications", "unread", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/notifications/unread?clerkId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error("Failed to fetch unread notifications");
      return res.json() as Promise<AppNotification[]>;
    },
    enabled: isLoaded && !!userId,
    refetchInterval: 10000,
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

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!userId) throw new Error("Not authenticated");
      const res = await fetch(`/api/notifications/${notificationId}/read?clerkId=${encodeURIComponent(userId)}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
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
