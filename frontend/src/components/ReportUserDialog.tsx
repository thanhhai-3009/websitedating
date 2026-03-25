import { useState } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getApiToken } from "@/lib/clerkToken";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  targetUserId: string;
  onReported?: () => void;
}

const reasons = [
  "Inappropriate messages",
  "Fake profile",
  "Harassment or threats",
  "Spam or scam",
  "Underage user",
  "Other",
];

const reasonToCategory = (reason: string): string => {
  switch (reason) {
    case "Inappropriate messages": return "inappropriate_content";
    case "Fake profile": return "fake_profile";
    case "Harassment or threats": return "harassment";
    case "Spam or scam": return "scam";
    case "Underage user": return "underage_user";
    case "Other": return "other";
    default: return "other";
  }
};

export const ReportUserDialog = ({ open, onOpenChange, userName, targetUserId, onReported }: ReportUserDialogProps) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!user) return;
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getApiToken(getToken);
      const response = await fetch("http://localhost:8080/api/moderation/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          clerkId: user.id,
          reportedUserId: targetUserId,
          reasonCategory: reasonToCategory(reason),
          reason: description || reason,
          evidenceUrls: []
        })
      });

      if (!response.ok) throw new Error("Failed to submit report");

      setSubmitted(true);
      toast({ title: "Report submitted", description: "Our team will review this report." });
      if (onReported) onReported();
    } catch (error) {
      toast({ title: "Error", description: "Could not submit report. Try again later.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setReason(""); setDescription(""); setSubmitted(false); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-success" />
            </div>
            <h3 className="font-serif text-xl font-semibold text-foreground">Report Submitted</h3>
            <p className="text-muted-foreground text-sm">We take reports seriously. Our team will review this within 24 hours.</p>
            <Button variant="outline" onClick={handleClose}>Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Report {userName}
              </DialogTitle>
              <DialogDescription>Help us keep the community safe. Select a reason for your report.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
                {reasons.map(r => (
                  <div key={r} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    reason === r ? "border-primary bg-coral-light/20" : "border-border hover:border-primary/40"
                  )}>
                    <RadioGroupItem value={r} id={r} />
                    <Label htmlFor={r} className="cursor-pointer flex-1">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div>
                <Label className="mb-2 block">Additional details (optional)</Label>
                <Textarea
                  placeholder="Describe what happened..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

