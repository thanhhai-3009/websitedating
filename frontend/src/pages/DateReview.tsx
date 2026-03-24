import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useReviewedAppointments } from "@/hooks/useReviewedAppointments";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Check, ShieldAlert, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@clerk/clerk-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// ─── Mock data (replace with API call using appointmentId) ───────────────────
const MOCK_APPOINTMENTS: Record<string, { name: string; initials: string; spot: string; date: string }> = {
  "3": { name: "Olivia M.", initials: "OM", spot: "Botanical Gardens", date: "Mar 10" },
};

// ─── Behaviour tags ──────────────────────────────────────────────────────────
const POSITIVE_TAGS = ["Lịch sự/Tôn trọng", "Nói chuyện cuốn hút"];
const NEGATIVE_TAGS = ["Thô lỗ", "Quấy rối/Ép buộc"];

type PhotoMatch = "90-100" | "50-80" | "under50" | null;
type WhoAbsent = "them" | "me" | null;

interface ReviewState {
  didMeet: boolean | null;
  whoAbsent: WhoAbsent;
  photoMatch: PhotoMatch;
  behaviourTags: string[];
  wantSimilar: boolean | null;
}

const STEPS = ["meet", "photo", "behaviour", "similar"] as const;
type Step = typeof STEPS[number];

const DateReview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId: clerkId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isReviewed, markReviewed } = useReviewedAppointments();
  const aptId = Number(id);

  const apt = MOCK_APPOINTMENTS[id ?? ""] ?? {
    name: "Người dùng",
    initials: "??",
    spot: "—",
    date: "—",
  };

  const [step, setStep] = useState<Step>("meet");
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<ReviewState>({
    didMeet: null,
    whoAbsent: null,
    photoMatch: null,
    behaviourTags: [],
    wantSimilar: null,
  });

  const toggleTag = (tag: string) =>
    setState((prev) => ({
      ...prev,
      behaviourTags: prev.behaviourTags.includes(tag)
        ? prev.behaviourTags.filter((t) => t !== tag)
        : [...prev.behaviourTags, tag],
    }));

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  // ─── Compute backend payload (double-blind: never exposed to other user) ──
  const buildPayload = () => {
    const hasHarassment = state.behaviourTags.includes("Quấy rối/Ép buộc");
    const hasRude = state.behaviourTags.includes("Thô lỗ");
    const positiveCount = state.behaviourTags.filter((t) => POSITIVE_TAGS.includes(t)).length;
    const fakePhoto = state.photoMatch === "under50";

    let verdict: "good" | "medium" | "negative" | "dangerous" = "good";
    if (hasHarassment) verdict = "dangerous";
    else if (hasRude || fakePhoto) verdict = "negative";
    else if (state.wantSimilar === false || state.photoMatch === "50-80") verdict = "medium";
    else if (positiveCount > 0 && state.wantSimilar === true) verdict = "good";

    return {
      appointmentId: String(id),
      reviewedUserId: apt.name, // replace with actual userId from API
      reviewerUserId: clerkId,
      didMeet: state.didMeet,
      whoAbsent: state.whoAbsent,           // backend deducts reputation from absent party
      photoMatch: state.photoMatch,          // backend flags profile if under50
      behaviourTags: state.behaviourTags,
      wantSimilar: state.wantSimilar,
      verdict,                               // backend acts: boost / suggest / lock 1mo / lock permanent
    };
  };

  const handleSubmit = async () => {
    if (state.wantSimilar === null) {
      toast({ title: "Vui lòng trả lời câu hỏi cuối", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const payload = buildPayload();
    
    try {
      await axios.post(`${API_BASE_URL}/api/reviews`, payload);
      markReviewed(aptId);
      setSubmitted(true);
      toast({ title: "Đã gửi đánh giá! 💕", description: "Cảm ơn bạn đã giúp cộng đồng an toàn hơn." });
    } catch (error) {
      console.error("[DateReview] Submit review error", error);
      toast({ title: "Lỗi hệ thống", description: "Không thể gửi đánh giá, vui lòng thử lại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Already reviewed guard ───────────────────────────────────────────────
  if (!submitted && isReviewed(aptId)) {
    return (
      <Layout isAuthenticated>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full text-center gradient-card">
            <CardContent className="pt-8 pb-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Đã đánh giá rồi</h2>
              <p className="text-muted-foreground text-sm">Bạn đã gửi đánh giá cho cuộc hẹn này trước đó.</p>
              <Button variant="gradient" asChild>
                <Link to="/appointments">Quay lại Lịch hẹn</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // ─── Success screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <Layout isAuthenticated>
        <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[60vh]">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="max-w-md w-full text-center gradient-card">
              <CardContent className="pt-8 pb-8 space-y-4">
                <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-primary-foreground" />
                </div>
                <h2 className="font-serif text-2xl font-bold text-foreground">Đánh giá đã được ghi nhận!</h2>
                <p className="text-muted-foreground text-sm">
                  Phản hồi của bạn được bảo mật hoàn toàn và chỉ dùng để cải thiện cộng đồng.
                </p>
                <Button variant="gradient" asChild>
                  <Link to="/appointments">Quay lại Lịch hẹn</Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout isAuthenticated>
      <div className="container mx-auto px-4 py-8 max-w-xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/appointments"><ArrowLeft className="w-4 h-4 mr-2" />Quay lại</Link>
          </Button>

          <div className="mb-6">
            <h1 className="text-3xl font-serif font-bold text-foreground mb-1">Đánh giá sau hẹn</h1>
            <p className="text-muted-foreground text-sm">Phản hồi ẩn danh · Bảo mật đôi chiều</p>
          </div>

          {/* Date info card */}
          <Card className="gradient-card mb-6">
            <CardContent className="p-4 flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="gradient-primary text-primary-foreground">{apt.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-serif font-semibold text-foreground">{apt.name}</p>
                <p className="text-sm text-muted-foreground">{apt.spot} · {apt.date}</p>
              </div>
            </CardContent>
          </Card>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  STEPS.indexOf(step) >= i ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Câu 1: Xác thực sự kiện ── */}
            {step === "meet" && (
              <motion.div key="meet" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <Card className="gradient-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">
                      Bạn và <span className="text-primary">{apt.name}</span> có gặp nhau ngoài đời không?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant={state.didMeet === true ? "gradient" : "outline"}
                      className="w-full"
                      onClick={() => { setState((p) => ({ ...p, didMeet: true, whoAbsent: null })); next(); }}
                    >
                      ✅ Có, chúng tôi đã gặp
                    </Button>
                    <Button
                      variant={state.didMeet === false ? "destructive" : "outline"}
                      className="w-full"
                      onClick={() => setState((p) => ({ ...p, didMeet: false }))}
                    >
                      ❌ Không, cuộc hẹn không diễn ra
                    </Button>

                    {state.didMeet === false && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2 pt-2">
                        <p className="text-sm text-muted-foreground">Ai là người không đến?</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={state.whoAbsent === "them" ? "destructive" : "outline"}
                            className="flex-1"
                            onClick={() => { setState((p) => ({ ...p, whoAbsent: "them" })); next(); }}
                          >
                            <UserX className="w-4 h-4 mr-1" />{apt.name} không đến
                          </Button>
                          <Button
                            size="sm"
                            variant={state.whoAbsent === "me" ? "outline" : "outline"}
                            className="flex-1"
                            onClick={() => { setState((p) => ({ ...p, whoAbsent: "me" })); next(); }}
                          >
                            Tôi không đến
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Câu 2: Độ tin cậy ảnh ── */}
            {step === "photo" && (
              <motion.div key="photo" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <Card className="gradient-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">
                      Ảnh đại diện của <span className="text-primary">{apt.name}</span> giống thực tế bao nhiêu?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(
                      [
                        { value: "90-100", label: "90–100% · Giống hệt", color: "bg-success/10 border-success/40 text-success" },
                        { value: "50-80", label: "50–80% · Có chỉnh sửa", color: "bg-accent/10 border-accent/40 text-accent" },
                        { value: "under50", label: "Dưới 50% · Khác xa / Lừa đảo", color: "bg-destructive/10 border-destructive/40 text-destructive" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setState((p) => ({ ...p, photoMatch: opt.value })); next(); }}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-lg border transition-all text-sm font-medium",
                          opt.color,
                          state.photoMatch === opt.value ? "ring-2 ring-offset-1 ring-primary" : "hover:opacity-80"
                        )}
                      >
                        {opt.label}
                        {opt.value === "under50" && <ShieldAlert className="inline w-4 h-4 ml-2" />}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Câu 3: Hành vi ── */}
            {step === "behaviour" && (
              <motion.div key="behaviour" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <Card className="gradient-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">
                      Chọn các đặc điểm bạn thấy ở <span className="text-primary">{apt.name}</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Có thể chọn nhiều mục</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[...POSITIVE_TAGS, ...NEGATIVE_TAGS].map((tag) => {
                      const isPositive = POSITIVE_TAGS.includes(tag);
                      const selected = state.behaviourTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all flex items-center justify-between",
                            selected
                              ? isPositive
                                ? "bg-success/15 border-success/50 text-success"
                                : "bg-destructive/15 border-destructive/50 text-destructive"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          <span>{isPositive ? "✅" : "⚠️"} {tag}</span>
                          <span className="text-xs opacity-60">{isPositive ? "+ điểm" : tag === "Quấy rối/Ép buộc" ? "− điểm nặng" : "− điểm"}</span>
                        </button>
                      );
                    })}
                    <Button variant="gradient" className="w-full mt-2" onClick={next}>
                      Tiếp tục
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Câu 4: Kết quả gợi ý ── */}
            {step === "similar" && (
              <motion.div key="similar" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                <Card className="gradient-card">
                  <CardHeader>
                    <CardTitle className="font-serif text-lg">
                      Bạn có muốn hệ thống tiếp tục gợi ý những người như{" "}
                      <span className="text-primary">{apt.name}</span> cho bạn không?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant={state.wantSimilar === true ? "gradient" : "outline"}
                      className="w-full"
                      onClick={() => setState((p) => ({ ...p, wantSimilar: true }))}
                    >
                      💚 Có, gợi ý thêm người tương tự
                    </Button>
                    <Button
                      variant={state.wantSimilar === false ? "destructive" : "outline"}
                      className="w-full"
                      onClick={() => setState((p) => ({ ...p, wantSimilar: false }))}
                    >
                      🚫 Không, tôi muốn kết quả khác hơn
                    </Button>
                    <Button
                      variant="hero"
                      className="w-full mt-2"
                      disabled={state.wantSimilar === null || isSubmitting}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? "Đang gửi..." : "Gửi đánh giá"}
                    </Button>
                  </CardContent>
                </Card>

                <p className="text-xs text-center text-muted-foreground mt-4 flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Đánh giá được bảo mật hoàn toàn · Người kia không thể xem phản hồi của bạn
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Layout>
  );
};

export default DateReview;
