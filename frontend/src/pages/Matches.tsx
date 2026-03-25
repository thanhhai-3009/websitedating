import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Layout } from "@/components/layout/Layout";
import { MatchCard } from "@/components/cards/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportUserDialog } from "@/components/ReportUserDialog";
import { BlockUserDialog } from "@/components/BlockUserDialog";

type DiscoverCandidate = {
  userId: string;
  displayName: string;
  age?: number;
  avatarUrl?: string;
  online?: boolean;
  matchedAt?: string;
  status?: string;
  likedByMe?: boolean;
};

type MatchViewModel = {
  id: string;
  name: string;
  age: number;
  image: string;
  lastActive?: string;
  isOnline?: boolean;
  status: "liked" | "matched" | "accepted";
  likedByMe: boolean;
  isNew: boolean;
};

export default function Matches() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [moderationUser, setModerationUser] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    const clerkId = user?.id;
    if (!clerkId) {
      setMatches([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchMatches = async () => {
      setLoading(true);
      setFetchError("");

      try {
        const response = await fetch(`/api/discovery/matches?clerkId=${encodeURIComponent(clerkId)}&limit=50&includeLiked=true&includeSentLiked=true`);
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          if (!cancelled) {
            setFetchError(data.message || "Failed to load matches");
            setMatches([]);
          }
          return;
        }

        const toStatus = (value?: string): MatchViewModel["status"] => {
          if (value === "accepted") return "accepted";
          if (value === "matched") return "matched";
          return "liked";
        };

        const data = (await response.json()) as DiscoverCandidate[];
        const mapped = data.map((candidate, index) => ({
          id: candidate.userId,
          name: candidate.displayName,
          age: candidate.age ?? 18,
          image:
            candidate.avatarUrl && candidate.avatarUrl.trim().length > 0
              ? candidate.avatarUrl
              : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
          lastActive: candidate.online ? "Online now" : "Recently active",
          isOnline: Boolean(candidate.online),
          status: toStatus(candidate.status),
          likedByMe: Boolean(candidate.likedByMe),
          isNew:
            typeof candidate.matchedAt === "string"
              ? Date.now() - new Date(candidate.matchedAt).getTime() < 3 * 24 * 60 * 60 * 1000
              : index < 6,
        }));

        if (!cancelled) {
          setMatches(mapped);
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : "Failed to load matches");
          setMatches([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMatches();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleMessageForUser = (targetUserId: string) => {
    navigate("/messages", {
      state: { selectedConversationId: targetUserId },
    });
  };

  const handlePromoteToMatch = async (targetUserId: string) => {
    if (!user?.id) return;
    setPromotingUserId(targetUserId);
    try {
      const response = await fetch("/api/discovery/connections/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          targetUserId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "Failed to confirm match");
      }

      setMatches((prev) =>
        prev.map((item) =>
          item.id === targetUserId ? { ...item, status: "matched", isNew: true, lastActive: "Recently matched" } : item
        )
      );
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Failed to confirm match");
    } finally {
      setPromotingUserId(null);
    }
  };

  const handleReport = (id: string, name: string) => {
    setModerationUser({ id, name });
    setReportDialogOpen(true);
  };

  const handleBlock = (id: string, name: string) => {
    setModerationUser({ id, name });
    setBlockDialogOpen(true);
  };

  const handleBlockedSuccess = (userId: string) => {
    setMatches(prev => prev.filter(m => m.id !== userId));
  };

  const likedYou = useMemo(() => matches.filter((m) => m.status === "liked" && !m.likedByMe), [matches]);
  const pendingSentInvites = useMemo(() => matches.filter((m) => m.status === "liked" && m.likedByMe), [matches]);
  const newMatches = useMemo(() => matches.filter((m) => m.status !== "liked" && m.isNew), [matches]);
  const allMatches = useMemo(() => matches.filter((m) => m.status !== "liked" && !m.isNew), [matches]);

  return (
    <Layout isAuthenticated>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary" />
              Matches
            </h1>
            <p className="text-muted-foreground mt-1">
              Your connections are waiting
            </p>
          </div>

          <Tabs defaultValue="matches" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="matches" className="gap-2">
                <Heart className="w-4 h-4" />
                Matches ({newMatches.length + allMatches.length})
              </TabsTrigger>
              <TabsTrigger value="likes" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Likes ({likedYou.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Sent ({pendingSentInvites.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="space-y-8">
              {fetchError && <p className="text-center text-destructive">{fetchError}</p>}
              {!fetchError && matches.length === 0 && (
                <p className="text-center text-muted-foreground">No matches yet. Keep discovering people to get more matches.</p>
              )}

              {!fetchError && likedYou.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" />
                    Likes You
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {likedYou.map((match, i) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <MatchCard
                          user={match}
                          actionLabel={promotingUserId === match.id ? "Matching..." : "Accept"}
                          actionDisabled={promotingUserId === match.id}
                          onAction={() => handlePromoteToMatch(match.id)}
                          onReport={() => handleReport(match.id, match.name)}
                          onBlock={() => handleBlock(match.id, match.name)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* New Matches */}
              {!fetchError && newMatches.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-gold" />
                    New Matches
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {newMatches.map((match, i) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <MatchCard
                          user={match}
                          isNew
                          onAction={handleMessageForUser}
                          onReport={() => handleReport(match.id, match.name)}
                          onBlock={() => handleBlock(match.id, match.name)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* All Matches */}
              {!fetchError && allMatches.length > 0 && (
                <section>
                  <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                    All Matches
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {allMatches.map((match, i) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <MatchCard
                          user={match}
                          onAction={handleMessageForUser}
                          onReport={() => handleReport(match.id, match.name)}
                          onBlock={() => handleBlock(match.id, match.name)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="likes">
              {!loading && fetchError && <p className="text-center text-destructive">{fetchError}</p>}
              {!loading && !fetchError && likedYou.length === 0 && (
                <p className="text-center text-muted-foreground">No one has liked you yet.</p>
              )}
              {!loading && !fetchError && likedYou.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {likedYou.map((match, i) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <MatchCard
                        user={match}
                        actionLabel={promotingUserId === match.id ? "Matching..." : "Accept"}
                        actionDisabled={promotingUserId === match.id}
                        onAction={() => handlePromoteToMatch(match.id)}
                        onReport={() => handleReport(match.id, match.name)}
                        onBlock={() => handleBlock(match.id, match.name)}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sent">
              {!loading && fetchError && <p className="text-center text-destructive">{fetchError}</p>}
              {!loading && !fetchError && pendingSentInvites.length === 0 && (
                <p className="text-center text-muted-foreground">You have no pending invites right now.</p>
              )}
              {!loading && !fetchError && pendingSentInvites.length > 0 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    These users received your match request and are waiting to accept.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {pendingSentInvites.map((match, i) => (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <MatchCard
                          user={match}
                          actionLabel="Pending"
                          actionDisabled
                          onReport={() => handleReport(match.id, match.name)}
                          onBlock={() => handleBlock(match.id, match.name)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {moderationUser && (
        <>
          <ReportUserDialog
            open={reportDialogOpen}
            onOpenChange={setReportDialogOpen}
            userName={moderationUser.name}
            targetUserId={moderationUser.id}
            onReported={() => {
              // Same as block if needed
            }}
          />
          <BlockUserDialog
            open={blockDialogOpen}
            onOpenChange={setBlockDialogOpen}
            userName={moderationUser.name}
            targetUserId={moderationUser.id}
            onBlocked={() => handleBlockedSuccess(moderationUser.id)}
          />
        </>
      )}
    </Layout>
  );
}

