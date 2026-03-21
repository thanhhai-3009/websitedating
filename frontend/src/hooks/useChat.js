import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client/dist/sockjs";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const CHAT_TYPES = new Set(["CHAT", "IMAGE", "JOIN", "LEAVE"]);

function toAbsoluteUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }
  return `${API_BASE_URL}/${url}`;
}

export function useChat(roomId) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const clientRef = useRef(null);

  const subscriptionTopic = useMemo(() => {
    if (!roomId) return null;
    return `/topic/room/${roomId}`;
  }, [roomId]);

  useEffect(() => {
    setMessages([]);
    setError(null);

    if (!subscriptionTopic) {
      setIsConnected(false);
      return undefined;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 5000,
      debug: () => {},
      beforeConnect: async () => {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }
        client.connectHeaders = {
          Authorization: `Bearer ${token}`,
        };
      },
      onConnect: () => {
        setError(null);
        setIsConnected(true);

        client.subscribe(subscriptionTopic, (frame) => {
          try {
            const incoming = JSON.parse(frame.body);
            if (!incoming?.type || !CHAT_TYPES.has(incoming.type)) {
              return;
            }
            if (incoming.roomId && incoming.roomId !== roomId) {
              return;
            }
            setMessages((prev) => [...prev, incoming]);
          } catch {
            setError("Received invalid message payload.");
          }
        });
      },
      onStompError: (frame) => {
        setIsConnected(false);
        setError(frame.headers?.message || "WebSocket STOMP error.");
      },
      onWebSocketClose: () => {
        setIsConnected(false);
        setError("Connection lost. Retrying...");
      },
      onWebSocketError: () => {
        setIsConnected(false);
        setError("WebSocket transport error.");
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      setIsConnected(false);
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
    };
  }, [getToken, roomId, subscriptionTopic]);

  const sendTextMessage = useCallback(
    async (content) => {
      const client = clientRef.current;
      if (!client || !client.connected || !roomId) {
        setError("Not connected to chat room.");
        return;
      }

      const payload = {
        roomId,
        content,
        type: "CHAT",
      };

      client.publish({
        destination: "/app/chat.sendMessage",
        body: JSON.stringify(payload),
      });
    },
    [roomId]
  );

  const sendImageMessage = useCallback(
    async (file) => {
      if (!roomId) {
        setError("Missing roomId.");
        return;
      }

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Missing auth token");
        }

        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await axios.post(`${API_BASE_URL}/api/files/upload`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });

        const imageUrl = typeof uploadResponse.data === "string" ? uploadResponse.data : uploadResponse.data?.url;
        if (!imageUrl) {
          throw new Error("Upload did not return an image URL.");
        }

        const imageUrlForMessage = toAbsoluteUrl(imageUrl);

        const client = clientRef.current;
        if (!client || !client.connected) {
          throw new Error("Not connected to chat room.");
        }

        client.publish({
          destination: "/app/chat.sendMessage",
          body: JSON.stringify({
            roomId,
            content: imageUrlForMessage,
            type: "IMAGE",
          }),
        });

        setError(null);
      } catch (uploadError) {
        const message = uploadError?.response?.data?.message || uploadError?.message || "Image upload failed.";
        setError(message);
      }
    },
    [getToken, roomId]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    isConnected,
    error,
    sendTextMessage,
    sendImageMessage,
    clearMessages,
  };
}
