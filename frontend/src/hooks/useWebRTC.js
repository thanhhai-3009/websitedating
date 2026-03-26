import { getApiToken } from "@/lib/clerkToken";
import { resolveWebSocketUrl, toApiUrl } from "@/lib/runtimeApi";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SIGNALING_WS_URL = resolveWebSocketUrl("/ws-signal");
const SIGNALING_TYPES = new Set(["OFFER", "ANSWER", "ICE_CANDIDATE", "LEAVE"]);
const DEFAULT_RTC_CONFIG = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

function parseSignalData(rawData) {
  if (!rawData) return null;
  if (typeof rawData === "string") {
    try {
      return JSON.parse(rawData);
    } catch {
      return null;
    }
  }
  return rawData;
}

function buildWebSocketUrl(baseUrl, token) {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

export function useWebRTC(roomId, senderId) {
  const { getToken, userId } = useAuth();
  const signalingSenderId = senderId || userId;

  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callMode, setCallMode] = useState("video");
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);

  const peerConnectionRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCallerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const activeTargetIdRef = useRef(null);
  const rtcConfigRef = useRef(DEFAULT_RTC_CONFIG);

  const normalizedRoomId = useMemo(() => roomId || null, [roomId]);

  useEffect(() => {
    let isMounted = true;

    const loadIceServers = async () => {
      try {
        const token = await getApiToken(getToken);
        const response = await fetch(toApiUrl("/api/webrtc/ice-servers"), {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });

        if (!response.ok || !isMounted) {
          return;
        }

        const payload = await response.json();
        const servers = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.iceServers)
          ? payload.iceServers
          : [];

        if (servers.length > 0) {
          rtcConfigRef.current = { iceServers: servers };
        }
      } catch {
        rtcConfigRef.current = DEFAULT_RTC_CONFIG;
      }
    };

    loadIceServers();
    return () => {
      isMounted = false;
    };
  }, [getToken]);

  const sendSignal = useCallback(
    (type, data, targetId = null) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !normalizedRoomId) {
        setCallError("Signaling is not connected.");
        return false;
      }

      if (!SIGNALING_TYPES.has(type)) {
        return false;
      }

      socket.send(
        JSON.stringify({
          roomId: normalizedRoomId,
          targetId,
          type,
          data,
        })
      );
      return true;
    },
    [normalizedRoomId]
  );

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    pendingIceCandidatesRef.current = [];
    pendingOfferRef.current = null;
    pendingCallerRef.current = null;
    activeTargetIdRef.current = null;
    setRemoteStream(null);
  }, []);

  const stopLocalMedia = useCallback(() => {
    setLocalStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
  }, []);

  const ensurePeerConnection = useCallback(
    (targetId = null) => {
      if (peerConnectionRef.current) {
        return peerConnectionRef.current;
      }

      const peerConnection = new RTCPeerConnection(rtcConfigRef.current || DEFAULT_RTC_CONFIG);

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const relayTarget = targetId || activeTargetIdRef.current || pendingCallerRef.current;
          if (relayTarget) {
            sendSignal("ICE_CANDIDATE", JSON.stringify(event.candidate), relayTarget);
          }
        }
      };

      peerConnection.ontrack = (event) => {
        if (event.streams?.[0]) {
          setRemoteStream(event.streams[0]);
          return;
        }
        const fallbackStream = new MediaStream([event.track]);
        setRemoteStream(fallbackStream);
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === "failed" || state === "disconnected" || state === "closed") {
          cleanupPeerConnection();
          stopLocalMedia();
          setIncomingCall(null);
          setIsInCall(false);
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    },
    [cleanupPeerConnection, sendSignal, stopLocalMedia]
  );

  const attachStreamToPeer = useCallback((peerConnection, stream) => {
    const existingTrackIds = new Set(
      peerConnection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter(Boolean)
    );

    stream.getTracks().forEach((track) => {
      if (!existingTrackIds.has(track.id)) {
        peerConnection.addTrack(track, stream);
      }
    });
  }, []);

  const flushPendingIceCandidates = useCallback(async (peerConnection) => {
    const pending = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of pending) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const startCall = useCallback(
    async (mode = "video", targetId = null) => {
      if (!normalizedRoomId) {
        setCallError("Missing roomId.");
        return;
      }
      if (!targetId) {
        setCallError("Missing target user id.");
        return;
      }

      try {
        setCallError(null);
        setIncomingCall(null);
        setCallMode(mode);
        activeTargetIdRef.current = targetId;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video",
        });
        setLocalStream(stream);

        const peerConnection = ensurePeerConnection(targetId);
        attachStreamToPeer(peerConnection, stream);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendSignal(
          "OFFER",
          JSON.stringify({
            sdp: offer,
            mode,
          }),
          targetId
        );

        setIsInCall(true);
      } catch (error) {
        setCallError(error?.message || "Could not start call.");
      }
    },
    [attachStreamToPeer, ensurePeerConnection, normalizedRoomId, sendSignal]
  );

  const acceptIncomingCall = useCallback(async () => {
    try {
      const pendingOffer = pendingOfferRef.current;
      const callerId = pendingCallerRef.current;
      if (!pendingOffer || !callerId) {
        return;
      }

      setCallError(null);
      setIncomingCall(null);
      activeTargetIdRef.current = callerId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callMode === "video",
      });
      setLocalStream(stream);

      const peerConnection = ensurePeerConnection(callerId);
      attachStreamToPeer(peerConnection, stream);

      await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      await flushPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      sendSignal("ANSWER", JSON.stringify(answer), callerId);
      setIsInCall(true);
    } catch (error) {
      setCallError(error?.message || "Could not accept call.");
    }
  }, [attachStreamToPeer, callMode, ensurePeerConnection, flushPendingIceCandidates, sendSignal]);

  const rejectIncomingCall = useCallback(() => {
    const callerId = pendingCallerRef.current;
    if (callerId) {
      sendSignal("LEAVE", JSON.stringify({ reason: "rejected" }), callerId);
    }
    setIncomingCall(null);
    pendingOfferRef.current = null;
    pendingCallerRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, [sendSignal]);

  const endCall = useCallback(() => {
    const targetId = activeTargetIdRef.current || pendingCallerRef.current;
    if (targetId) {
      sendSignal("LEAVE", "{}", targetId);
    }
    cleanupPeerConnection();
    stopLocalMedia();
    setIncomingCall(null);
    setIsInCall(false);
    setCallError(null);
  }, [cleanupPeerConnection, sendSignal, stopLocalMedia]);

  useEffect(() => {
    if (!normalizedRoomId || !signalingSenderId) {
      setIsSignalingConnected(false);
      return undefined;
    }

    shouldReconnectRef.current = true;

    const connect = async () => {
      try {
        const token = await getApiToken(getToken);
        if (!token) {
          setCallError("Missing auth token for signaling.");
          return;
        }

        const socket = new WebSocket(buildWebSocketUrl(SIGNALING_WS_URL, token));
        wsRef.current = socket;

        socket.onopen = () => {
          setIsSignalingConnected(true);
          setCallError(null);
        };

        socket.onmessage = async (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (!payload?.type || !SIGNALING_TYPES.has(payload.type)) {
              return;
            }

            if (payload.roomId && payload.roomId !== normalizedRoomId) {
              return;
            }

            if (payload.senderId && payload.senderId === signalingSenderId) {
              return;
            }

            if (payload.type === "LEAVE") {
              cleanupPeerConnection();
              stopLocalMedia();
              setIncomingCall(null);
              setIsInCall(false);
              return;
            }

            if (payload.type === "OFFER") {
              const parsed = parseSignalData(payload.data);
              const offer = parsed?.sdp || parsed;
              const incomingMode = parsed?.mode === "audio" ? "audio" : "video";
              if (!offer) {
                return;
              }

              setCallMode(incomingMode);
              pendingOfferRef.current = offer;
              pendingCallerRef.current = payload.senderId || null;
              activeTargetIdRef.current = payload.senderId || null;
              pendingIceCandidatesRef.current = [];
              setIncomingCall({
                fromId: payload.senderId || "Unknown",
                mode: incomingMode,
              });
              return;
            }

            if (payload.type === "ANSWER") {
              const parsed = parseSignalData(payload.data);
              const answer = parsed?.sdp || parsed;
              if (peerConnectionRef.current && answer) {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
                await flushPendingIceCandidates(peerConnectionRef.current);
              }
              return;
            }

            if (payload.type === "ICE_CANDIDATE") {
              const candidate = parseSignalData(payload.data);
              if (!candidate) {
                return;
              }

              if (peerConnectionRef.current?.remoteDescription) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                pendingIceCandidatesRef.current.push(candidate);
              }
            }
          } catch (error) {
            setCallError(error?.message || "Signaling processing failed.");
          }
        };

        socket.onerror = () => {
          setIsSignalingConnected(false);
        };

        socket.onclose = () => {
          setIsSignalingConnected(false);
          if (shouldReconnectRef.current) {
            reconnectTimerRef.current = window.setTimeout(connect, 3000);
          }
        };
      } catch (error) {
        setCallError(error?.message || "Failed to connect signaling socket.");
      }
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      cleanupPeerConnection();
      stopLocalMedia();
      setIncomingCall(null);
      setIsSignalingConnected(false);
      setIsInCall(false);
    };
  }, [cleanupPeerConnection, flushPendingIceCandidates, getToken, normalizedRoomId, signalingSenderId, stopLocalMedia]);

  return {
    isSignalingConnected,
    isInCall,
    callMode,
    callError,
    incomingCall,
    localStream,
    remoteStream,
    startAudioCall: (targetId = null) => startCall("audio", targetId),
    startVideoCall: (targetId = null) => startCall("video", targetId),
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
  };
}
