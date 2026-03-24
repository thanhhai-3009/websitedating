import { motion } from "framer-motion";
import { MessageCircle, Heart, MoreHorizontal, ShieldOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MatchCardProps {
  user: {
    id: string;
    name: string;
    age: number;
    image: string;
    lastActive?: string;
    isOnline?: boolean;
  };
  isNew?: boolean;
  onClick?: () => void;
  onAction?: (userId: string) => void;
  onReport?: (userId: string) => void;
  onBlock?: (userId: string) => void;
  actionLabel?: string;
  actionDisabled?: boolean;
  className?: string;
}

export const MatchCard = ({
  user,
  isNew = false,
  onClick,
  onAction,
  onReport,
  onBlock,
  actionLabel = "Message",
  actionDisabled = false,
  className,
}: MatchCardProps) => {
  return (
    <motion.div
      className={cn(
        "relative flex flex-col items-center p-4 rounded-2xl bg-card shadow-card cursor-pointer hover:shadow-md transition-shadow group/card",
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {/* Options Dropdown */}
      <div className="absolute top-2 left-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="w-7 h-7 rounded-full bg-muted/50 hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem 
              className="text-destructive gap-2 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onReport?.(user.id); }}
            >
              <AlertTriangle className="w-4 h-4" />
              Report
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive gap-2 cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onBlock?.(user.id); }}
            >
              <ShieldOff className="w-4 h-4" />
              Block
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Match Indicator */}
      {isNew && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full gradient-primary flex items-center justify-center animate-pulse-soft">
          <Heart className="w-3 h-3 text-primary-foreground" />
        </div>
      )}

      {/* Avatar */}
      <div className="relative text-center">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-coral-light mx-auto">
          <img
            src={user.image}
            alt={user.name}
            className="w-full h-full object-cover"
          />
        </div>
        {user.isOnline && (
          <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-online border-2 border-card" />
        )}
      </div>

      {/* Info */}
      <div className="mt-3 text-center">
        <h4 className="font-medium text-foreground">
          {user.name}, {user.age}
        </h4>
        {user.lastActive && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {user.isOnline ? "Online now" : user.lastActive}
          </p>
        )}
      </div>

      {/* Primary Action Button */}
      <Button
        size="sm"
        variant="soft"
        className="mt-3 gap-1 w-full"
        disabled={actionDisabled}
        onClick={(e) => {
          e.stopPropagation();
          onAction?.(user.id);
        }}
      >
        <MessageCircle className="w-4 h-4" />
        {actionLabel}
      </Button>
    </motion.div>
  );
};
