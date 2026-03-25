import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiToken } from "@/lib/clerkToken";

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  targetUserId: string;
  onBlocked?: () => void;
}

export const BlockUserDialog = ({ open, onOpenChange, userName, targetUserId, onBlocked }: BlockUserDialogProps) => {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBlock = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const token = await getApiToken(getToken);
      const response = await fetch("http://localhost:8080/api/moderation/block", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          clerkId: user.id,
          targetUserId: targetUserId,
          reason: "Blocked from UI"
        })
      });

      if (!response.ok) throw new Error("Failed to block user");

      toast({ title: `${userName} blocked`, description: "They won't be able to see your profile or contact you." });
      onOpenChange(false);
      if (onBlocked) onBlocked();
    } catch (error) {
      toast({ title: "Error", description: "Could not block user. Try again later.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-destructive" />
            Block {userName}?
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">Blocking {userName} will:</span>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Remove them from your matches</li>
              <li>Prevent them from messaging you</li>
              <li>Hide your profile from them</li>
              <li>Cancel any pending dates</li>
            </ul>
            <span className="block text-xs">This action can be undone from your settings.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button variant="destructive" onClick={handleBlock} disabled={isSubmitting}>
            {isSubmitting ? "Blocking..." : "Block User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

