import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { Layout } from "@/components/layout/Layout";
import { MatchCard } from "@/components/cards/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DiscoverCandidate = {
  userId: string;
  displayName: string;
  age?: number;
  avatarUrl?: string;
  online?: boolean;
  matchedAt?: string;
};

type MatchViewModel = {
  id: string;
  name: string;
  age: number;
  image: string;
  lastActive?: string;
  isOnline?: boolean;
  isNew: boolean;
};

const mockLikes = [
  {
    id: "7",
    name: "Charlotte",
    age: 26,
    image: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop",
    lastActive: "1 hour ago",
    isOnline: false,
    isNew: true,
  },
  {
    id: "8",
    name: "Amelia",
    age: 25,
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop",
    lastActive: "2 hours ago",
    isOnline: true,
    isNew: true,
  },
];

export default function Matches() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

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
        const response = await fetch(`/api/discovery/matches?clerkId=${encodeURIComponent(clerkId)}&limit=50`);
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          if (!cancelled) {
            setFetchError(data.message || "Failed to load matches");
            setMatches([]);
          }
          return;
        }

        const data = (await response.json()) as DiscoverCandidate[];
        const mapped = data.map((candidate, index) => ({
          id: candidate.userId,
          name: candidate.displayName,
          age: candidate.age ?? 18,
          image:
            candidate.avatarUrl && candidate.avatarUrl.trim().length > 0
              ? candidate.avatarUrl
              : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
          lastActive: candidate.online ? "Online now" : "Recently matched",
          isOnline: Boolean(candidate.online),
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

  const handleMessage = () => {
    navigate("/messages");
  };

  const newMatches = useMemo(() => matches.filter((m) => m.isNew), [matches]);
  const allMatches = useMemo(() => matches.filter((m) => !m.isNew), [matches]);

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
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="matches" className="gap-2">
                <Heart className="w-4 h-4" />
                Matches ({matches.length})
              </TabsTrigger>
              <TabsTrigger value="likes" className="gap-2">
                <Sparkles className="w-4 h-4" />
                Likes ({mockLikes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches" className="space-y-8">
              {loading && <p className="text-center text-muted-foreground">Loading matches...</p>}
              {!loading && fetchError && <p className="text-center text-destructive">{fetchError}</p>}
              {!loading && !fetchError && matches.length === 0 && (
                <p className="text-center text-muted-foreground">No matches yet. Keep discovering people to get more matches.</p>
              )}

              {/* New Matches */}
              {!loading && !fetchError && newMatches.length > 0 && (
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
                          onMessage={handleMessage}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* All Matches */}
              {!loading && !fetchError && allMatches.length > 0 && (
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
                          onMessage={handleMessage}
                        />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="likes">
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-primary-foreground" />
                </div>
                <h3 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  {mockLikes.length} people like you
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Upgrade to Premium to see who likes you and match with them instantly
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                  {mockLikes.map((like) => (
                    <div key={like.id} className="relative">
                      <img
                        src={like.image}
                        alt={like.name}
                        className="w-full aspect-square rounded-2xl object-cover blur-lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center">
                          <Heart className="w-6 h-6 text-primary-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
