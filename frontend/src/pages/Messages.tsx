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
  Crown,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { resolveApiBaseUrl, toApiUrl } from "@/lib/runtimeApi";
import { useChat } from "@/hooks/useChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE_URL = resolveApiBaseUrl();

interface MatchApiResponse {
  userId: string;
  clerkId?: string;
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
  clerkId?: string;
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
  if (url.startsWith("/")) return API_BASE_URL ? `${API_BASE_URL}${url}` : url;
  return API_BASE_URL ? `${API_BASE_URL}/${url}` : `/${url}`;
};

export default function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const preselectedConversationId = (location.state as { selectedConversationId?: string } | null)?.selectedConversationId;
  const { userId: clerkId, userId } = useAuth();
  const { isLoading: isCurrentUserLoading } = useCurrentUser();
  // Tam thoi mo khoa tinh nang messenger/video call de test MVP.
  const isMessagesLocked = false;
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [selfDbUserId, setSelfDbUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
  const [selectedVideoInputId, setSelectedVideoInputId] = useState("");
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState("");
  const [devicesError, setDevicesError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const hasAppliedPreselectedRef = useRef(false);

  useEffect(() => {
    hasAppliedPreselectedRef.current = false;
  }, [preselectedConversationId]);

  useEffect(() => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      setDevicesError("Media device selection is not supported in this browser.");
      return undefined;
    }

    let isMounted = true;

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!isMounted) {
          return;
        }

        const inputs = devices.filter((device) => device.kind === "audioinput");
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const outputs = devices.filter((device) => device.kind === "audiooutput");
        setAudioInputDevices(inputs);
        setVideoInputDevices(cameras);
        setAudioOutputDevices(outputs);

        setSelectedAudioInputId((previous) => {
          if (previous && inputs.some((device) => device.deviceId === previous)) {
            return previous;
          }
          return inputs[0]?.deviceId || "";
        });

        setSelectedAudioOutputId((previous) => {
          if (previous && outputs.some((device) => device.deviceId === previous)) {
            return previous;
          }
          return outputs[0]?.deviceId || "";
        });

        setSelectedVideoInputId((previous) => {
          if (previous && cameras.some((device) => device.deviceId === previous)) {
            return previous;
          }
          return cameras[0]?.deviceId || "";
        });

        setDevicesError(null);
      } catch (error: any) {
        if (!isMounted) {
          return;
        }
        setDevicesError(error?.message || "Cannot enumerate media devices.");
      }
    };

    loadDevices();

    const handleDeviceChange = () => {
      loadDevices();
    };

    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      isMounted = false;
      navigator.mediaDevices.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      if (!clerkId) {
        return;
      }

      if (isMessagesLocked) {
        setConversations([]);
        setSelectedConversation(null);
        setIsLoadingConversations(false);
        setConversationsError(null);
        return;
      }

      setIsLoadingConversations(true);
      setConversationsError(null);

      try {
         const matchesResponse = await axios.get<MatchApiResponse[]>(toApiUrl("/api/discovery/matches"), {
           params: {
             clerkId,
             // Hien ca like da nhan/da gui de co danh sach test chat ngay ca khi chua mutual match.
             includeLiked: true,
             includeSentLiked: true,
           },
         });

        if (!isMounted) return;

        const mappedConversations = (matchesResponse.data || []).map((match) => ({
          id: match.userId,
          userId: match.userId,
          clerkId: match.clerkId,
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

        const preselectedMatch = preselectedConversationId
          ? mappedConversations.find(
              (conversation) =>
                conversation.id === preselectedConversationId
                || conversation.userId === preselectedConversationId
                || conversation.clerkId === preselectedConversationId
            )
          : null;

        setSelectedConversation((previous) => {
          if (preselectedMatch && !hasAppliedPreselectedRef.current) {
            hasAppliedPreselectedRef.current = true;
            return preselectedMatch.id;
          }

          if (previous && mappedConversations.some((conversation) => conversation.id === previous)) {
            return previous;
          }

          return mappedConversations[0]?.id || null;
        });
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

    const refreshId = window.setInterval(() => {
      loadConversations();
    }, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshId);
    };
  }, [clerkId, isMessagesLocked, preselectedConversationId]);

  useEffect(() => {
    let isMounted = true;
    const resolveUser = async () => {
      if (!clerkId) {
        setSelfDbUserId(null);
        return;
      }
      try {
        const response = await axios.get<ResolvedUserResponse>(toApiUrl(`/api/users/resolve/${encodeURIComponent(clerkId)}`));
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
  const roomId = useMemo(() => {
    if (!selectedChat) {
      return null;
    }

    if (selectedChat.roomId) {
      return selectedChat.roomId;
    }

    // Fallback for old match records without roomId.
    if (selfDbUserId && selectedChat.userId) {
      return `dm-${[selfDbUserId, selectedChat.userId].sort().join("-")}`;
    }

    return null;
  }, [selectedChat, selfDbUserId]);

  const effectiveRoomId = isMessagesLocked ? null : roomId;
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
  const currentDbUserId = isMessagesLocked ? null : (selfDbUserId || roomDerivedDbUserId);

  const {
    messages: liveMessages,
    isConnected,
    error,
    sendTextMessage,
    sendImageMessage,
  } = useChat(effectiveRoomId);

  const mappedLiveMessages = useMemo(() => {
    return (liveMessages || []).map((msg: any, index: number) => {
      const isImage = msg?.type === "IMAGE";
      const senderId = typeof msg?.senderId === "string" ? msg.senderId : "";

      const mineCandidates = [currentDbUserId, selfDbUserId, clerkId, userId].filter(
        (value): value is string => Boolean(value)
      );

      let mine = senderId ? mineCandidates.includes(senderId) : false;

      // Defensive fallback for DM rooms when sender format differs across environments.
      if (!mine && senderId && selectedChat?.userId) {
        mine = senderId !== selectedChat.userId;
      }

      return {
        id: msg?.id || `${msg?.timestamp || "msg"}-${index}`,
        message: isImage ? "" : msg?.content || "",
        image: isImage ? msg?.content : undefined,
        timestamp: toDisplayTimestamp(msg?.timestamp),
        isOwn: mine,
        status: mine ? ("sent" as const) : undefined,
      };
    });
  }, [clerkId, currentDbUserId, liveMessages, selectedChat?.userId, selfDbUserId, userId]);

  const mediaPreferences = useMemo(
    () => ({
      audioInputDeviceId: selectedAudioInputId || null,
      videoInputDeviceId: selectedVideoInputId || null,
    }),
    [selectedAudioInputId, selectedVideoInputId]
  );

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
  } = useWebRTC(effectiveRoomId, clerkId, mediaPreferences);

  const callTargetId = selectedChat?.clerkId || null;

  useEffect(() => {
    if (!messagesViewportRef.current) {
      return;
    }

    // Keep latest message visible when opening room and when new messages arrive.
    const viewport = messagesViewportRef.current;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [mappedLiveMessages.length, selectedConversation]);

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

  useEffect(() => {
    if (!selectedAudioOutputId || !remoteAudioRef.current) {
      return;
    }

    const audioElement = remoteAudioRef.current as HTMLAudioElement & {
      setSinkId?: (deviceId: string) => Promise<void>;
    };

    if (typeof audioElement.setSinkId !== "function") {
      return;
    }

    audioElement.setSinkId(selectedAudioOutputId).catch((error: any) => {
      setDevicesError(error?.message || "Cannot switch audio output device.");
    });
  }, [selectedAudioOutputId, remoteStream]);

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
      <div className="h-[calc(100vh-4rem)] relative">
        <div className={cn("h-full flex", isMessagesLocked && "blur-sm pointer-events-none select-none") }>
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
                  <Button variant="ghost" size="icon" onClick={() => startAudioCall(callTargetId)}>
                    <Phone className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => startVideoCall(callTargetId)}>
                    <Video className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-border bg-card/60 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Microphone</span>
                  <select
                    className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedAudioInputId}
                    onChange={(event) => setSelectedAudioInputId(event.target.value)}
                  >
                    {audioInputDevices.length === 0 && <option value="">Default</option>}
                    {audioInputDevices.map((device, index) => (
                      <option key={device.deviceId || `input-${index}`} value={device.deviceId}>
                        {device.label || `Microphone ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Camera</span>
                  <select
                    className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedVideoInputId}
                    onChange={(event) => setSelectedVideoInputId(event.target.value)}
                  >
                    {videoInputDevices.length === 0 && <option value="">Default</option>}
                    {videoInputDevices.map((device, index) => (
                      <option key={device.deviceId || `video-${index}`} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Speaker</span>
                  <select
                    className="h-8 max-w-56 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedAudioOutputId}
                    onChange={(event) => setSelectedAudioOutputId(event.target.value)}
                  >
                    {audioOutputDevices.length === 0 && <option value="">Default</option>}
                    {audioOutputDevices.map((device, index) => (
                      <option key={device.deviceId || `output-${index}`} value={device.deviceId}>
                        {device.label || `Speaker ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
                {isConnected ? "Chat connected" : "Connecting chat..."}
                {roomId ? ` | room: ${roomId}` : ""}
                {conversationsError ? ` | ${conversationsError}` : ""}
                {error ? ` | ${error}` : ""}
                {callError ? ` | ${callError}` : ""}
                {devicesError ? ` | ${devicesError}` : ""}
              </div>

              <div ref={messagesViewportRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                <div ref={messagesEndRef} />
              </div>

              <ChatInput
                onSend={handleSendMessage}
                onImageClick={handleImageClick}
                onEmojiSelect={appendEmoji}
                emojiOptions={emojiList}
                onVideoCall={() => startVideoCall(callTargetId)}
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

        {isMessagesLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[2px] px-4">
            <div className="max-w-md w-full rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-white">
                <Crown className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Premium required for Messages</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upgrade to Premium to unlock messaging with your matches.
              </p>
              <Button className="mt-5" variant="gradient" onClick={() => navigate("/premium")}>
                Upgrade to Premium
              </Button>
            </div>
          </div>
        )}

        {Boolean(clerkId) && isCurrentUserLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
            <p className="text-sm text-muted-foreground">Checking premium access...</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
