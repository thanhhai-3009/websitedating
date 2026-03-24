import { getApiToken } from "@/lib/clerkToken";
import { useAuth } from "@clerk/clerk-react";
import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client/dist/sockjs";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
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

  const stompRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCallerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const rtcConfigRef = useRef(DEFAULT_RTC_CONFIG);

  const topic = useMemo(() => {
    if (!roomId) return null;
    return `/topic/room/${roomId}`;
  }, [roomId]);

  useEffect(() => {
    let isMounted = true;
    const loadIceServers = async () => {
      try {
        const token = await getApiToken(getToken);
        const response = await fetch(`${API_BASE_URL}/api/webrtc/ice-servers`, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        const servers = Array.isArray(payload?.iceServers) ? payload.iceServers : [];
        if (!isMounted || servers.length === 0) {
          return;
        }
        rtcConfigRef.current = { iceServers: servers };
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
      const client = stompRef.current;
      if (!client || !client.connected || !roomId) {
        setCallError("Signaling is not connected.");
        return false;
      }

      client.publish({
        destination: "/app/webrtc.signal",
        body: JSON.stringify({
          roomId,
          senderId: signalingSenderId,
          targetId,
          type,
          data,
        }),
      });
      return true;
    },
    [roomId, signalingSenderId]
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
    setRemoteStream(null);
  }, []);

  const stopLocalMedia = useCallback(() => {
    setLocalStream((prevStream) => {
      if (prevStream) {
        prevStream.getTracks().forEach((track) => track.stop());
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
          sendSignal("ICE_CANDIDATE", JSON.stringify(event.candidate), targetId);
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
    const pendingCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const candidate of pendingCandidates) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const startCall = useCallback(
    async (mode = "video", targetId = null) => {
      if (!roomId) {
        setCallError("Missing roomId.");
        return;
      }

      try {
        setCallError(null);
        setIncomingCall(null);
        setCallMode(mode);

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
    [attachStreamToPeer, ensurePeerConnection, roomId, sendSignal]
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
    sendSignal("LEAVE", "{}");
    cleanupPeerConnection();
    stopLocalMedia();
    setIncomingCall(null);
    setIsInCall(false);
    setCallError(null);
  }, [cleanupPeerConnection, sendSignal, stopLocalMedia]);

  useEffect(() => {
    if (!topic) {
      setIsSignalingConnected(false);
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
        setIsSignalingConnected(true);
        setCallError(null);

        client.subscribe(topic, async (frame) => {
          try {
            const payload = JSON.parse(frame.body);
            if (!payload?.type || !SIGNALING_TYPES.has(payload.type)) {
              return;
            }
            if (payload.targetId && payload.targetId !== signalingSenderId) {
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
        });
      },
      onWebSocketClose: () => {
        setIsSignalingConnected(false);
      },
      onWebSocketError: () => {
        setIsSignalingConnected(false);
        setCallError("WebRTC signaling transport error.");
      },
      onStompError: (frame) => {
        setIsSignalingConnected(false);
        setCallError(frame.headers?.message || "STOMP signaling error.");
      },
    });

    client.activate();
    stompRef.current = client;

    return () => {
      if (stompRef.current) {
        stompRef.current.deactivate();
        stompRef.current = null;
      }
      cleanupPeerConnection();
      stopLocalMedia();
      setIncomingCall(null);
      setIsSignalingConnected(false);
      setIsInCall(false);
    };
  }, [cleanupPeerConnection, flushPendingIceCandidates, getToken, signalingSenderId, stopLocalMedia, topic]);

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

