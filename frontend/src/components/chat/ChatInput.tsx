import { useState } from "react";
import { Send, Image, Smile, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSend: (message: string) => void;
  onImageClick?: () => void;
  onEmojiClick?: () => void;
  onVideoCall?: () => void;
  value?: string;
  onChange?: (value: string) => void;
}

export const ChatInput = ({
  onSend,
  onImageClick,
  onEmojiClick,
  onVideoCall,
  value,
  onChange,
}: ChatInputProps) => {
  const [internalMessage, setInternalMessage] = useState("");
  const isControlled = value !== undefined;
  const message = isControlled ? value : internalMessage;

  const setMessage = (nextValue: string) => {
    if (!isControlled) {
      setInternalMessage(nextValue);
    }
    onChange?.(nextValue);
  };

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-card border-t border-border">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={onImageClick}
          type="button"
        >
          <Image className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={onEmojiClick}
          type="button"
        >
          <Smile className="w-5 h-5" />
        </Button>
      </div>
      <Input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Type a message..."
        className="flex-1 bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary"
      />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          onClick={onVideoCall}
          type="button"
        >
          <Video className="w-5 h-5" />
        </Button>
        <Button
          variant="gradient"
          size="icon"
          className="rounded-full"
          onClick={handleSend}
          disabled={!message.trim()}
          type="button"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
