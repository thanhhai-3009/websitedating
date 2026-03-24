import { useRef, useState } from "react";
import { useChat } from "@/hooks/useChat";

export default function ChatComponent({ roomId }) {
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);
  const { messages, isConnected, error, sendTextMessage, sendImageMessage } = useChat(roomId);

  const onSendText = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;

    await sendTextMessage(value);
    setText("");
  };

  const onPickImage = () => {
    fileInputRef.current?.click();
  };

  const onImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await sendImageMessage(file);
    event.target.value = "";
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h2>Room: {roomId}</h2>
      <p>Status: {isConnected ? "Connected" : "Connecting..."}</p>
      {error ? <p style={{ color: "crimson" }}>Error: {error}</p> : null}

      <div style={{ border: "1px solid #ddd", borderRadius: 8, minHeight: 280, padding: 12, marginBottom: 12 }}>
        {messages.map((message, index) => {
          const isImage = message.type === "IMAGE";
          return (
            <div key={message.id || `${message.timestamp || "t"}-${index}`} style={{ marginBottom: 10 }}>
              <strong>{message.type || "CHAT"}</strong>
              {isImage ? (
                <div>
                  <img src={message.content} alt="Shared" style={{ maxWidth: 240, borderRadius: 6, marginTop: 6 }} />
                </div>
              ) : (
                <p style={{ marginTop: 6 }}>{message.content}</p>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={onSendText} style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a message..."
          style={{ flex: 1, padding: "8px 10px" }}
        />
        <button type="button" onClick={onPickImage}>Upload image</button>
        <button type="submit">Send</button>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onImageChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

