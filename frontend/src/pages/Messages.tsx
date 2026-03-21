import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Verified,
  PhoneOff,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { useWebRTC } from "@/hooks/useWebRTC";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface MatchApiResponse {
  userId: string;
  displayName: string;
  age?: number;
  avatarUrl?: string;
  online?: boolean;
  matchedAt?: string;
  roomId?: string;
}

interface ConversationItem {
  id: string;
  userId: string;
  roomId?: string;
  user: {
    name: string;
    age?: number;
    image: string;
    isOnline: boolean;
    verified: boolean;
  };
  timestamp: string;
}

interface ResolvedUserResponse {
  id: string;
  clerkId: string;
}

const emojiList = ["😀", "😂", "😍", "🥰", "😎", "😅", "😘", "🥳", "❤️", "🔥", "🌹", "✨"];

const toDisplayTime = (value?: string) => {
  if (!value) {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const toDisplayTimestamp = (value?: string) => {
  if (!value) {
    return "Now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toAbsoluteMediaUrl = (url?: string) => {
  if (!url) return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
  return `${API_BASE_URL}/${url}`;
};

export default function Messages() {
  const location = useLocation();
  const preselectedConversationId = (location.state as { selectedConversationId?: string } | null)?.selectedConversationId;
  const { userId: clerkId, userId } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [selfDbUserId, setSelfDbUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      if (!clerkId) {
        return;
      }

      setIsLoadingConversations(true);
      setConversationsError(null);

      try {
         const matchesResponse = await axios.get<MatchApiResponse[]>(`${API_BASE_URL}/api/discovery/matches`, {
           params: { clerkId },
         });

        if (!isMounted) return;

        const mappedConversations = (matchesResponse.data || []).map((match) => ({
          id: match.userId,
          userId: match.userId,
          roomId: match.roomId,
          user: {
            name: match.displayName || "Match",
            age: match.age,
            image: toAbsoluteMediaUrl(match.avatarUrl),
            isOnline: Boolean(match.online),
            verified: true,
          },
          timestamp: toDisplayTimestamp(match.matchedAt),
        }));

        setConversations(mappedConversations);

        const hasPreselected =
          preselectedConversationId
          && mappedConversations.some((conversation) => conversation.id === preselectedConversationId);

        if (hasPreselected) {
          setSelectedConversation(preselectedConversationId);
        } else if (!selectedConversation && mappedConversations.length > 0) {
          setSelectedConversation(mappedConversations[0].id);
        }
      } catch (loadError: any) {
        if (!isMounted) return;
        const message = loadError?.response?.data?.message || loadError?.message || "Cannot load matches from backend.";
        setConversationsError(message);
      } finally {
        if (isMounted) {
          setIsLoadingConversations(false);
        }
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [clerkId, preselectedConversationId, selectedConversation]);

  useEffect(() => {
    let isMounted = true;
    const resolveUser = async () => {
      if (!clerkId) {
        setSelfDbUserId(null);
        return;
      }
      try {
        const response = await axios.get<ResolvedUserResponse>(`${API_BASE_URL}/api/users/resolve/${encodeURIComponent(clerkId)}`);
        if (!isMounted) return;
        setSelfDbUserId(response.data?.id || null);
      } catch {
        if (!isMounted) return;
        setSelfDbUserId(null);
      }
    };
    resolveUser();
    return () => {
      isMounted = false;
    };
  }, [clerkId]);

  const selectedChat = conversations.find((c) => c.id === selectedConversation);
  const roomId = selectedChat?.roomId || null;
  const roomDerivedDbUserId = useMemo(() => {
    if (!roomId || !selectedChat?.userId || !roomId.startsWith("dm-")) {
      return null;
    }
    const ids = roomId.substring(3).split("-");
    if (ids.length < 2) {
      return null;
    }
    return ids[0] === selectedChat.userId ? ids[1] : ids[0];
  }, [roomId, selectedChat?.userId]);
  const currentDbUserId = selfDbUserId || roomDerivedDbUserId;

  const {
    messages: liveMessages,
    isConnected,
    error,
    sendTextMessage,
    sendImageMessage,
  } = useChat(roomId, currentDbUserId);

  const {
    isInCall,
    callMode,
    callError,
    incomingCall,
    localStream,
    remoteStream,
    startAudioCall,
    startVideoCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
  } = useWebRTC(roomId, currentDbUserId);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
      localVideoRef.current.play().catch(() => {});
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const mappedLiveMessages = useMemo(() => {
    return (liveMessages || []).map((msg: any, index: number) => {
      const isImage = msg?.type === "IMAGE";
      const mine = msg?.senderId ? msg.senderId === currentDbUserId || msg.senderId === userId : false;
      return {
        id: msg?.id || `${msg?.timestamp || "msg"}-${index}`,
        message: isImage ? "" : msg?.content || "",
        image: isImage ? msg?.content : undefined,
        timestamp: toDisplayTime(msg?.timestamp),
        isOwn: mine,
        status: mine ? ("sent" as const) : undefined,
      };
    });
  }, [currentDbUserId, liveMessages, userId]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;
    await sendTextMessage(message.trim());
    setDraftMessage("");
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await sendImageMessage(file);
    event.target.value = "";
  };

  const appendEmoji = (emoji: string) => {
    setDraftMessage((prev) => `${prev}${emoji}`);
  };

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.trim().toLowerCase();
    return conversations.filter((conversation) => conversation.user.name.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  return (
    <Layout isAuthenticated>
      <div className="h-[calc(100vh-4rem)] flex">
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col",
            selectedConversation && "hidden md:flex"
          )}
        >
          <div className="p-4 border-b border-border">
            <h1 className="font-serif text-2xl font-bold text-foreground mb-4">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations && (
              <p className="p-4 text-sm text-muted-foreground">Loading matches...</p>
            )}
            {!isLoadingConversations && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No conversations from backend yet.</p>
            )}
            {filteredConversations.map((conversation) => (
              <motion.button
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation.id)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left",
                  selectedConversation === conversation.id && "bg-secondary"
                )}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative">
                  <img
                    src={conversation.user.image}
                    alt={conversation.user.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                  {conversation.user.isOnline && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-online border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">
                        {conversation.user.name}{conversation.user.age ? `, ${conversation.user.age}` : ""}
                      </span>
                      {conversation.user.verified && (
                        <Verified className="w-4 h-4 text-blue-500 fill-blue-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{conversation.timestamp}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "flex-1 flex flex-col bg-background",
            !selectedConversation && "hidden md:flex"
          )}
        >
          {selectedChat ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div className="relative">
                    <img
                      src={selectedChat.user.image}
                      alt={selectedChat.user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    {selectedChat.user.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-card" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-foreground">
                        {selectedChat.user.name}
                      </span>
                      {selectedChat.user.verified && (
                        <Verified className="w-4 h-4 text-blue-500 fill-blue-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {selectedChat.user.isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startAudioCall(selectedChat.userId)}>
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => startVideoCall(selectedChat.userId)}>
                    <Video className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                {isConnected ? "Chat connected" : "Connecting chat..."}
                {roomId ? ` | room: ${roomId}` : ""}
                {conversationsError ? ` | ${conversationsError}` : ""}
                {error ? ` | ${error}` : ""}
                {callError ? ` | ${callError}` : ""}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {mappedLiveMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet. Send the first message.</p>
                ) : (
                  mappedLiveMessages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg.message}
                      image={msg.image}
                      timestamp={msg.timestamp}
                      isOwn={msg.isOwn}
                      status={msg.status}
                    />
                  ))
                )}
              </div>

              <ChatInput
                onSend={handleSendMessage}
                onImageClick={handleImageClick}
                onEmojiSelect={appendEmoji}
                emojiOptions={emojiList}
                onVideoCall={() => startVideoCall(selectedChat.userId)}
                value={draftMessage}
                onChange={setDraftMessage}
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <Dialog open={isInCall}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{callMode === "audio" ? "Audio call" : "Video call"}</DialogTitle>
                    <DialogDescription>
                      {selectedChat.user.name} - press end call to stop.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-xs text-muted-foreground mb-2">You</p>
                      {callMode === "video" ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-md bg-black min-h-48" />
                      ) : (
                        <div className="w-full min-h-48 rounded-md bg-black/80 flex items-center justify-center text-white text-sm">
                          Audio only
                         </div>
                      )}
                      <audio ref={localAudioRef} autoPlay muted className="hidden" />
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-xs text-muted-foreground mb-2">{selectedChat.user.name}</p>
                      {callMode === "video" ? (
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-md bg-black min-h-48" />
                      ) : (
                        <div className="w-full min-h-48 rounded-md bg-black/80 flex items-center justify-center text-white text-sm">
                          Connecting audio...
                        </div>
                      )}
                      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button variant="destructive" onClick={endCall} className="gap-2">
                      <PhoneOff className="w-4 h-4" />
                      End call
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={Boolean(incomingCall) && !isInCall}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Incoming {incomingCall?.mode === "audio" ? "audio" : "video"} call</DialogTitle>
                    <DialogDescription>
                      {selectedChat.user.name} is calling you.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" onClick={rejectIncomingCall}>Reject</Button>
                    <Button variant="gradient" onClick={acceptIncomingCall}>Accept</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                  Select a conversation
                </h3>
                <p className="text-sm">Choose a matched user from backend.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
