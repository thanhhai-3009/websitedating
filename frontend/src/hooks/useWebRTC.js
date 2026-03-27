import { getApiToken } from "@/lib/clerkToken";
import { resolveWebSocketUrl, toApiUrl } from "@/lib/runtimeApi";
import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const SIGNALING_TYPES = new Set(["OFFER", "ANSWER", "ICE_CANDIDATE", "LEAVE"]);
const DEFAULT_RTC_CONFIG = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

function buildTrackConstraint(deviceId) {
  if (!deviceId) {
    return true;
  }
  // exact can fail silently on mobile browsers; ideal is safer across tunnel + iOS/Android.
  return { deviceId: { ideal: deviceId } };
}

function buildVideoConstraint(deviceId) {
  if (deviceId) {
    return {
      deviceId: { ideal: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
    };
  }

  // Prefer front camera on mobile; desktop browsers ignore facingMode safely.
  return {
    facingMode: { ideal: "user" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24, max: 30 },
  };
}

function buildMediaConstraints(mode, mediaPreferences = null) {
  const audioInputDeviceId = mediaPreferences?.audioInputDeviceId || null;
  const videoInputDeviceId = mediaPreferences?.videoInputDeviceId || null;

  return {
    audio: buildTrackConstraint(audioInputDeviceId),
    video: mode === "video" ? buildVideoConstraint(videoInputDeviceId) : false,
  };
}

async function getPreferredUserMedia(mode, mediaPreferences = null) {
  const constraints = buildMediaConstraints(mode, mediaPreferences);
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (mode === "video" && stream.getVideoTracks().length === 0) {
      throw new Error("Camera stream is unavailable.");
    }
    stream.getTracks().forEach((track) => {
      track.enabled = true;
    });
    return stream;
  } catch (error) {
    const hasPreferredDevice = Boolean(
      mediaPreferences?.audioInputDeviceId || mediaPreferences?.videoInputDeviceId
    );

    // Retry with safer fallback constraints for mobile browsers.
    const fallbackConstraints = {
      audio: true,
      video: mode === "video"
        ? {
            facingMode: { ideal: "user" },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 20, max: 24 },
          }
        : false,
    };

    // If no explicit device chosen, keep old behavior: throw original error.
    if (!hasPreferredDevice) {
      const secondTry = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      if (mode === "video" && secondTry.getVideoTracks().length === 0) {
        throw error;
      }
      secondTry.getTracks().forEach((track) => {
        track.enabled = true;
      });
      return secondTry;
    }

    const fallbackStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
    if (mode === "video" && fallbackStream.getVideoTracks().length === 0) {
      throw new Error("Camera stream is unavailable.");
    }

    fallbackStream.getTracks().forEach((track) => {
      track.enabled = true;
    });
    return fallbackStream;
  }
}

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

function normalizeSessionDescription(rawData) {
  const parsed = parseSignalData(rawData);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  // Case A: wrapped payload { sdp: { type, sdp }, mode }
  if (parsed.sdp && typeof parsed.sdp === "object" && parsed.sdp.type && parsed.sdp.sdp) {
    return parsed.sdp;
  }

  // Case B: direct payload { type, sdp }
  if (parsed.type && parsed.sdp) {
    return parsed;
  }

  return null;
}

export function useWebRTC(roomId, senderId, mediaPreferences = null) {
  const { getToken, userId } = useAuth();
  const signalingSenderId = senderId || userId;
  const signalingWsUrl = useMemo(() => resolveWebSocketUrl("/ws-signal"), []);

  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [callError, setCallError] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callMode, setCallMode] = useState("video");
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(true);

  const peerConnectionRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCallerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const activeTargetIdRef = useRef(null);
  const activeSignalRoomIdRef = useRef(null);
  const rtcConfigRef = useRef(DEFAULT_RTC_CONFIG);
  const remoteStreamRef = useRef(new MediaStream());
  const cameraFacingModeRef = useRef("user");

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
    (type, data, targetId = null, roomIdOverride = null) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setCallError("Signaling is not connected.");
        return false;
      }

      if (!SIGNALING_TYPES.has(type)) {
        return false;
      }

      socket.send(
        JSON.stringify({
          roomId: roomIdOverride || activeSignalRoomIdRef.current || normalizedRoomId || null,
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
    activeSignalRoomIdRef.current = null;
    remoteStreamRef.current = new MediaStream();
    setRemoteStream(null);
  }, []);

  const stopLocalMedia = useCallback(() => {
    setLocalStream((prev) => {
      if (prev) {
        prev.getTracks().forEach((track) => track.stop());
      }
      return null;
    });
    setIsMuted(false);
    setIsCameraOff(false);
    cameraFacingModeRef.current = "user";
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
        const aggregated = remoteStreamRef.current || new MediaStream();

        // Merge all incoming tracks (works whether browser sends event.streams or bare track).
        const incomingTracks = event.streams?.[0]?.getTracks?.() || [event.track];
        incomingTracks.forEach((track) => {
          const exists = aggregated.getTracks().some((value) => value.id === track.id);
          if (!exists) {
            aggregated.addTrack(track);
          }
        });

        remoteStreamRef.current = aggregated;
        // Force React/video refresh with a fresh MediaStream instance.
        setRemoteStream(new MediaStream(aggregated.getTracks()));
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;

        if (state === "failed" || state === "closed") {
          cleanupPeerConnection();
          stopLocalMedia();
          setIncomingCall(null);
          setIsInCall(false);
          return;
        }

        // "disconnected" can be transient on mobile/wifi handover.
        if (state === "disconnected") {
          window.setTimeout(() => {
            if (peerConnectionRef.current?.connectionState === "disconnected") {
              cleanupPeerConnection();
              stopLocalMedia();
              setIncomingCall(null);
              setIsInCall(false);
            }
          }, 5000);
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    },
    [cleanupPeerConnection, sendSignal, stopLocalMedia]
  );

  const flushPendingIceCandidates = useCallback(async (peerConnection) => {
    const pending = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of pending) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  const startCall = useCallback(
    async (mode = "video", targetId = null) => {
      if (!targetId) {
        setCallError("Missing target user id.");
        return;
      }

      try {
        setCallError(null);
        setIncomingCall(null);
        setCallMode(mode);
        activeTargetIdRef.current = targetId;
        activeSignalRoomIdRef.current = normalizedRoomId || null;

        const stream = await getPreferredUserMedia(mode, mediaPreferences);
        setLocalStream(stream);
        setIsMuted(false);
        setIsCameraOff(mode !== "video");

        const peerConnection = ensurePeerConnection(targetId);
        // Caller must attach local tracks before creating offer (full-duplex fix).
        peerConnection.getSenders().forEach((sender) => {
          if (sender.track && (sender.track.kind === "audio" || sender.track.kind === "video")) {
            try {
              peerConnection.removeTrack(sender);
            } catch {
              // Ignore stale sender errors.
            }
          }
        });
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        const sent = sendSignal(
          "OFFER",
          JSON.stringify({
            sdp: offer,
            mode,
          }),
          targetId
        );

        if (!sent) {
          cleanupPeerConnection();
          stopLocalMedia();
          setIsInCall(false);
          return;
        }

        setIsInCall(true);
      } catch (error) {
        setCallError(error?.message || "Could not start call.");
      }
    },
    [cleanupPeerConnection, ensurePeerConnection, mediaPreferences, normalizedRoomId, sendSignal, stopLocalMedia]
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

      const stream = await getPreferredUserMedia(callMode, mediaPreferences);
      setLocalStream(stream);
      setIsMuted(false);
      setIsCameraOff(callMode !== "video");

      const peerConnection = ensurePeerConnection(callerId);
      // Callee must attach local tracks before creating answer (full-duplex fix).
      peerConnection.getSenders().forEach((sender) => {
        if (sender.track && (sender.track.kind === "audio" || sender.track.kind === "video")) {
          try {
            peerConnection.removeTrack(sender);
          } catch {
            // Ignore stale sender errors.
          }
        }
      });
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      await flushPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      const sent = sendSignal("ANSWER", JSON.stringify(answer), callerId);
      if (!sent) {
        cleanupPeerConnection();
        stopLocalMedia();
        setIsInCall(false);
        return;
      }

      setIsInCall(true);
    } catch (error) {
      setCallError(error?.message || "Could not accept call.");
    }
  }, [callMode, cleanupPeerConnection, ensurePeerConnection, flushPendingIceCandidates, mediaPreferences, sendSignal, stopLocalMedia]);

  const rejectIncomingCall = useCallback(() => {
    const callerId = pendingCallerRef.current;
    if (callerId) {
      sendSignal("LEAVE", JSON.stringify({ reason: "rejected" }), callerId, activeSignalRoomIdRef.current);
    }
    setIncomingCall(null);
    pendingOfferRef.current = null;
    pendingCallerRef.current = null;
    pendingIceCandidatesRef.current = [];
  }, [sendSignal]);

  const endCall = useCallback(() => {
    const targetId = activeTargetIdRef.current || pendingCallerRef.current;
    if (targetId) {
      sendSignal("LEAVE", "{}", targetId, activeSignalRoomIdRef.current);
    }
    cleanupPeerConnection();
    stopLocalMedia();
    setIncomingCall(null);
    setIsInCall(false);
    setCallError(null);
  }, [cleanupPeerConnection, sendSignal, stopLocalMedia]);

  const toggleMute = useCallback(() => {
    if (!localStream) {
      return;
    }
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    const nextMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, [isMuted, localStream]);

  const toggleCamera = useCallback(() => {
    if (!localStream) {
      return;
    }
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length === 0) {
      return;
    }

    const nextCameraOff = !isCameraOff;
    videoTracks.forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setIsCameraOff(nextCameraOff);
  }, [isCameraOff, localStream]);

  const flipCamera = useCallback(async () => {
    if (!localStream || callMode !== "video") {
      return;
    }

    const nextFacing = cameraFacingModeRef.current === "user" ? "environment" : "user";

    try {
      const flippedStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });

      const nextVideoTrack = flippedStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        return;
      }

      nextVideoTrack.enabled = !isCameraOff;

      localStream.getVideoTracks().forEach((track) => {
        localStream.removeTrack(track);
        track.stop();
      });
      localStream.addTrack(nextVideoTrack);

      const peerConnection = peerConnectionRef.current;
      if (peerConnection) {
        const videoSender = peerConnection.getSenders().find((sender) => sender.track?.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(nextVideoTrack);
        } else {
          peerConnection.addTrack(nextVideoTrack, localStream);
        }
      }

      cameraFacingModeRef.current = nextFacing;
      setLocalStream(new MediaStream(localStream.getTracks()));

      flippedStream.getTracks().forEach((track) => {
        if (track.id !== nextVideoTrack.id) {
          track.stop();
        }
      });
    } catch (error) {
      setCallError(error?.message || "Cannot switch camera.");
    }
  }, [callMode, isCameraOff, localStream]);

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

        if (!/^wss?:\/\//i.test(signalingWsUrl)) {
          setCallError("Invalid signaling websocket URL in VITE_WEBRTC_WS_URL.");
          return;
        }

        const wsUrl = buildWebSocketUrl(signalingWsUrl, token);
        const socket = new WebSocket(wsUrl);
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
              const offer = normalizeSessionDescription(payload.data);
              const parsed = parseSignalData(payload.data);
              const incomingMode = parsed?.mode === "audio" ? "audio" : "video";
              if (!offer) {
                return;
              }

              setCallMode(incomingMode);
              pendingOfferRef.current = offer;
              pendingCallerRef.current = payload.senderId || null;
              activeTargetIdRef.current = payload.senderId || null;
              activeSignalRoomIdRef.current = payload.roomId || normalizedRoomId || null;
              pendingIceCandidatesRef.current = [];
              setIncomingCall({
                fromId: payload.senderId || "Unknown",
                mode: incomingMode,
              });
              return;
            }

            if (payload.type === "ANSWER") {
              const answer = normalizeSessionDescription(payload.data);
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
          setCallError("WebSocket signaling error.");
        };

        socket.onclose = () => {
          setIsSignalingConnected(false);
          if (shouldReconnectRef.current) {
            reconnectTimerRef.current = window.setTimeout(connect, 3000);
          }
        };
      } catch (error) {
        setCallError(error?.message || `Failed to connect signaling socket: ${signalingWsUrl}`);
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
  }, [cleanupPeerConnection, flushPendingIceCandidates, getToken, normalizedRoomId, signalingSenderId, signalingWsUrl, stopLocalMedia]);

  return {
    isSignalingConnected,
    isInCall,
    callMode,
    callError,
    incomingCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    startAudioCall: (targetId = null) => startCall("audio", targetId),
    startVideoCall: (targetId = null) => startCall("video", targetId),
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    flipCamera,
  };
}
