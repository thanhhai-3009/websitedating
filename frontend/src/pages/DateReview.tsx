import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, ArrowLeft, Check, Heart, MapPin, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth, useUser } from "@clerk/clerk-react";
import { getApiToken } from "@/lib/clerkToken";

const tags = ["Great conversation", "Very kind", "Good listener", "Funny", "Respectful", "Charming", "Adventurous", "Thoughtful"];

interface DateReviewResponse {
  id: string;
  appointmentId: string;
  reviewerUserId: string;
  reviewedUserId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  wouldMeetAgain?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AppointmentResponse {
  id: string;
  creatorId?: string;
  participantId?: string;
  status?: string;
  scheduledTime?: string;
  location?: {
    placeName?: string;
    address?: string;
  };
}

export default function DateReview() {
  const { id: appointmentId } = useParams();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [wouldMeetAgain, setWouldMeetAgain] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentResponse | null>(null);
  const [existingReview, setExistingReview] = useState<DateReviewResponse | null>(null);
  const [counterpartName, setCounterpartName] = useState("Your match");

  const counterpartInitials = useMemo(() => {
    return counterpartName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => value[0]?.toUpperCase())
      .join("") || "M";
  }, [counterpartName]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!appointmentId || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getApiToken(getToken);
        if (!token) {
          throw new Error("Missing auth token");
        }

        const [appointmentRes, reviewRes, matchesRes] = await Promise.all([
          fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`),
          fetch(`/api/date-reviews/appointment/${encodeURIComponent(appointmentId)}/mine`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/discovery/matches?clerkId=${encodeURIComponent(user.id)}&limit=200`),
        ]);

        if (!isMounted) return;

        if (appointmentRes.ok) {
          const appointmentData = (await appointmentRes.json()) as AppointmentResponse;
          setAppointment(appointmentData);

          // If appointment is not completed, do not allow review submission
          if (appointmentData.status && String(appointmentData.status).toLowerCase() !== "completed") {
            // still allow loading existing review (if any), but inform user
            toast({
              title: "Không thể viết review",
              description: "Bạn chỉ có thể viết review cho các cuộc hẹn đã hoàn thành.",
              variant: "destructive",
            });
          }

          const counterpartId =
            appointmentData.creatorId && appointmentData.creatorId !== appointmentData.participantId
              ? appointmentData.creatorId
              : appointmentData.participantId;

          if (matchesRes.ok) {
            const matches = await matchesRes.json();
            const found = (matches || []).find(
              (value: any) => String(value.userId ?? value.clerkId ?? value.id) === String(counterpartId)
            );
            if (found) {
              setCounterpartName(found.displayName || found.username || found.name || "Your match");
            }
          }
        }

        if (reviewRes.ok) {
          const reviewData = (await reviewRes.json()) as DateReviewResponse;
          setExistingReview(reviewData);
          setRating(reviewData.rating || 0);
          setReview(reviewData.comment || "");
          setSelectedTags(reviewData.tags || []);
          setWouldMeetAgain(
            typeof reviewData.wouldMeetAgain === "boolean" ? reviewData.wouldMeetAgain : null
          );
        } else if (reviewRes.status !== 404) {
          throw new Error("Cannot load existing review");
        }
      } catch (error: any) {
        toast({
          title: "Không tải được dữ liệu review",
          description: error?.message || "Vui lòng thử lại.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [appointmentId, getToken, toast, user?.id]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentId) {
      toast({ title: "Thiếu appointmentId", variant: "destructive" });
      return;
    }

    if (rating === 0) {
      toast({ title: "Please add a rating", variant: "destructive" });
      return;
    }

    try {
      // prevent submit if appointment is not completed
      if (appointment?.status && String(appointment.status).toLowerCase() !== "completed") {
        toast({ title: "Không thể lưu review", description: "Chỉ có thể đánh giá cuộc hẹn đã hoàn thành.", variant: "destructive" });
        return;
      }
      const token = await getApiToken(getToken);
      if (!token) {
        throw new Error("Missing auth token");
      }

      const payload = {
        rating,
        comment: review,
        tags: selectedTags,
        wouldMeetAgain,
      };

      const response = await fetch(`/api/date-reviews/appointment/${encodeURIComponent(appointmentId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Submit review failed");
      }

      const saved = (await response.json()) as DateReviewResponse;
      setExistingReview(saved);
      setSubmitted(true);
      toast({
        title: existingReview ? "Review updated" : "Review submitted!",
        description: "Cảm ơn bạn đã chia sẻ trải nghiệm.",
      });
    } catch (error: any) {
      toast({
        title: "Lưu review thất bại",
        description: error?.message || "Vui lòng thử lại.",
        variant: "destructive",
      });
    }
  };

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
                <h2 className="font-serif text-2xl font-bold text-foreground">
                  {existingReview ? "Review Saved" : "Review Submitted"}
                </h2>
                <p className="text-muted-foreground">Your feedback helps make the community better.</p>
                <Button variant="gradient" asChild>
                  <Link to="/appointments">Back to Appointments</Link>
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
            <Link to="/appointments"><ArrowLeft className="w-4 h-4 mr-2" />Back to Appointments</Link>
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Rate Your Date</h1>
            <p className="text-muted-foreground">
              {existingReview ? "You already reviewed this date. You can edit below." : "Share how your experience went"}
            </p>
          </div>

          <Card className="gradient-card mb-6">
            <CardContent className="p-5 flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="gradient-primary text-primary-foreground text-lg">{counterpartInitials}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-serif font-semibold text-foreground">{counterpartName}</h3>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {appointment?.location?.placeName || "Date spot"}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {appointment?.scheduledTime
                      ? new Date(appointment.scheduledTime).toLocaleDateString()
                      : "Completed date"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="gradient-card">
              <CardContent className="py-8 text-center text-muted-foreground">Loading review data...</CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle className="text-lg font-serif">Overall Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "w-10 h-10 transition-colors",
                            (hoverRating || rating) >= star ? "fill-accent text-accent" : "text-border"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle className="text-lg font-serif">What stood out?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm border transition-all",
                          selectedTags.includes(tag)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle className="text-lg font-serif">Would you meet again?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 justify-center">
                    <Button
                      type="button"
                      variant={wouldMeetAgain === true ? "gradient" : "outline"}
                      onClick={() => setWouldMeetAgain(true)}
                      className="gap-2 flex-1 max-w-[140px]"
                    >
                      <Heart className="w-4 h-4" />Yes!
                    </Button>
                    <Button
                      type="button"
                      variant={wouldMeetAgain === false ? "destructive" : "outline"}
                      onClick={() => setWouldMeetAgain(false)}
                      className="flex-1 max-w-[140px]"
                    >
                      Not really
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card">
                <CardHeader>
                  <CardTitle className="text-lg font-serif">Write a Review (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Share your experience..."
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    maxLength={500}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{review.length}/500</p>
                </CardContent>
              </Card>

              <Button type="submit" variant="hero" className="w-full">
                {existingReview ? "Update Review" : "Submit Review"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
