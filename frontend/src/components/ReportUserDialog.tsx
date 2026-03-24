import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  reportedUserId: string;
  reporterClerkId: string;
}

const REASON_OPTIONS = [
  { label: "Inappropriate messages", value: "harassment" },
  { label: "Fake profile", value: "fake_profile" },
  { label: "Harassment or threats", value: "harassment" },
  { label: "Spam or scam", value: "scam" },
  { label: "Inappropriate content", value: "inappropriate_content" },
  { label: "Other", value: "other" },
];

export const ReportUserDialog = ({ open, onOpenChange, userName, reportedUserId, reporterClerkId }: ReportUserDialogProps) => {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterClerkId,
          reportedUserId,
          reasonCategory: reason,
          reason: description || reason,
          evidenceUrls: [],
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit report", variant: "destructive" });
    } finally {
      setIsLoading(false);
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
                {REASON_OPTIONS.map(r => (
                  <div key={r.label} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                    reason === r.value ? "border-primary bg-coral-light/20" : "border-border hover:border-primary/40"
                  )}>
                    <RadioGroupItem value={r.value} id={r.label} />
                    <Label htmlFor={r.label} className="cursor-pointer flex-1">{r.label}</Label>
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
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button variant="destructive" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Submitting..." : "Submit Report"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
