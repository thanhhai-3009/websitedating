import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";

export function WebRTCDiagnostics() {
  const { getToken } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const addLog = (msg: string) => {
    console.log(msg);
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const testCamera = async () => {
    addLog("Testing camera access...");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      addLog("✅ Camera access granted");
      addLog(`📹 Video tracks: ${mediaStream.getVideoTracks().length}`);
      addLog(`🎤 Audio tracks: ${mediaStream.getAudioTracks().length}`);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error: any) {
      addLog(`❌ Camera error: ${error.message}`);
    }
  };

  const testWebSocket = async () => {
    addLog("Testing WebSocket connection...");
    try {
      const token = await getToken();
      addLog(`Token obtained: ${token ? "Yes" : "No"}`);

      const wsUrl = `wss://guest-tip-packaging-consolidated.trycloudflare.com/ws-signal?token=${encodeURIComponent(token!)}`;
      addLog(`Connecting to: ${wsUrl.substring(0, 80)}...`);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        addLog("✅ WebSocket connected");
        ws.send(JSON.stringify({ type: "PING" }));
      };

      ws.onmessage = (event) => {
        addLog(`📨 Received: ${event.data.substring(0, 100)}`);
      };

      ws.onerror = (event) => {
        addLog(`❌ WebSocket error: ${JSON.stringify(event)}`);
      };

      ws.onclose = (event) => {
        addLog(`🔌 WebSocket closed (code: ${event.code})`);
      };

      setTimeout(() => ws.close(), 5000);
    } catch (error: any) {
      addLog(`❌ WebSocket test error: ${error.message}`);
    }
  };

  const testAPICall = async () => {
    addLog("Testing API call...");
    try {
      const token = await getToken();
      const response = await fetch(
        "https://guest-tip-packaging-consolidated.trycloudflare.com/api/webrtc/ice-servers",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      addLog(`API response status: ${response.status}`);
      const data = await response.json();
      addLog(`✅ ICE servers: ${JSON.stringify(data).substring(0, 100)}`);
    } catch (error: any) {
      addLog(`❌ API error: ${error.message}`);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">WebRTC Diagnostics</h1>

      <div className="space-y-4 mb-6">
        <Button onClick={testCamera} className="mr-2">
          Test Camera
        </Button>
        <Button onClick={testWebSocket} className="mr-2">
          Test WebSocket
        </Button>
        <Button onClick={testAPICall} className="mr-2">
          Test API
        </Button>
      </div>

      {stream && (
        <div className="mb-6">
          <h2 className="font-bold mb-2">Camera Preview</h2>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-lg bg-black"
            style={{ maxHeight: "400px" }}
          />
        </div>
      )}

      <div className="bg-secondary p-4 rounded-lg max-h-96 overflow-y-auto">
        <h2 className="font-bold mb-2">Debug Log</h2>
        {log.map((msg, i) => (
          <div key={i} className="text-sm font-mono text-foreground mb-1">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}

