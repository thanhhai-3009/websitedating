import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, Sparkles } from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { Layout } from "@/components/layout/Layout";
import { ProfileCard } from "@/components/cards/ProfileCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

type DiscoverCandidate = {
  userId: string;
  displayName: string;
  age?: number;
  location?: string;
  bio?: string;
  avatarUrl?: string;
  interests?: string[];
  verified?: boolean;
  distanceKm?: number;
};

type DiscoverFilter = "natural" | "location" | "interests";

const NATURAL_SEEN_STORAGE_PREFIX = "discover:natural:seen:";

const getSeenStorageKey = (clerkId: string) => `${NATURAL_SEEN_STORAGE_PREFIX}${clerkId}`;

const loadSeenUserIds = (clerkId: string) => {
  try {
    const raw = localStorage.getItem(getSeenStorageKey(clerkId));
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as string[];
    return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return [] as string[];
  }
};

const saveSeenUserIds = (clerkId: string, userIds: string[]) => {
  try {
    localStorage.setItem(getSeenStorageKey(clerkId), JSON.stringify(userIds.slice(-500)));
  } catch {
    // Ignore storage errors to keep Discover functional in private mode.
  }
};

export default function Discover() {
  const { user } = useUser();
  const [users, setUsers] = useState<DiscoverCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [useLocationFilter, setUseLocationFilter] = useState(false);
  const [useInterestFilter, setUseInterestFilter] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const { toast } = useToast();

  const activeFilter: DiscoverFilter = useLocationFilter
    ? "location"
    : useInterestFilter
      ? "interests"
      : "natural";

  const currentUser = users[currentIndex];

  const getCurrentPosition = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => reject(new Error("Location permission denied")),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });

  useEffect(() => {
    const clerkId = user?.id;
    if (!clerkId) return;

    let cancelled = false;

    const fetchCandidates = async () => {
      setLoading(true);
      setFetchError("");
      try {
        const recommendationsEndpoint = `/api/discovery/recommendations?clerkId=${encodeURIComponent(clerkId)}&limit=40`;
        let endpoint = recommendationsEndpoint;

        if (activeFilter === "location") {
          const position = await getCurrentPosition();
          endpoint = `/api/discovery/nearby?clerkId=${encodeURIComponent(clerkId)}&longitude=${position.longitude}&latitude=${position.latitude}&radiusKm=40&limit=40`;
        } else if (activeFilter === "interests") {
          endpoint = recommendationsEndpoint;
        } else {
          endpoint = recommendationsEndpoint;
        }

        let response = await fetch(endpoint);

        if (!response.ok && activeFilter === "location") {
          response = await fetch(recommendationsEndpoint);
        }

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message || "Failed to load recommendations");
        }

        const data = (await response.json()) as DiscoverCandidate[];
        if (!cancelled) {
          if (activeFilter === "natural") {
            const seenIds = new Set(loadSeenUserIds(clerkId));
            const unseen = data.filter((candidate) => !seenIds.has(candidate.userId));
            const seen = data.filter((candidate) => seenIds.has(candidate.userId));
            setUsers(unseen.length > 0 ? [...unseen, ...seen] : data);
          } else {
            setUsers(data);
          }
          setCurrentIndex(0);
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(error instanceof Error ? error.message : "Failed to load recommendations");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCandidates();

    return () => {
      cancelled = true;
    };
  }, [activeFilter, user?.id]);

  const markSeenIfNatural = (userId: string) => {
    if (!user?.id || activeFilter !== "natural") return;
    const seenIds = loadSeenUserIds(user.id);
    if (seenIds.includes(userId)) return;
    saveSeenUserIds(user.id, [...seenIds, userId]);
  };

  const currentCard = useMemo(() => {
    if (!currentUser) return null;
    return {
      id: currentUser.userId,
      name: currentUser.displayName,
      age: currentUser.age ?? 0,
      location: currentUser.location || "Unknown location",
      bio: currentUser.bio || "",
      image:
        currentUser.avatarUrl && currentUser.avatarUrl.trim().length > 0
          ? currentUser.avatarUrl
          : "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop",
      interests: currentUser.interests || [],
      verified: Boolean(currentUser.verified),
      distance:
        typeof currentUser.distanceKm === "number"
          ? `${currentUser.distanceKm.toFixed(1)} km away`
          : undefined,
    };
  }, [currentUser]);

  const nextCard = () => {
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setDirection(null);
    }, 300);
  };

  const recordInteraction = async (
    actionType: "like" | "pass" | "match",
    interactionType?: "like" | "match_invite"
  ) => {
    if (!user?.id || !currentUser) return;
    await fetch("/api/discovery/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkId: user.id,
        targetUserId: currentUser.userId,
        actionType,
        interactionType,
      }),
    });
  };

  const handleLike = () => {
    if (!currentUser) return;
    markSeenIfNatural(currentUser.userId);
    setDirection("right");
    recordInteraction("like", "match_invite").catch(() => null);
    toast({
      title: "Invite sent to " + currentUser.displayName,
      description: "Wait for them to accept your invite to become a match.",
    });
    nextCard();
  };

  const handlePass = () => {
    if (!currentUser) return;
    markSeenIfNatural(currentUser.userId);
    setDirection("left");
    recordInteraction("pass").catch(() => null);
    nextCard();
  };

  const handleSuperLike = () => {
    if (!currentUser) return;
    markSeenIfNatural(currentUser.userId);
    setDirection("right");
    recordInteraction("like", "match_invite").catch(() => null);
    toast({
      title: "⭐ Super Like sent to " + currentUser.displayName + "!",
      description: "They'll see you at the top of their list.",
    });
    nextCard();
  };

  return (
    <Layout isAuthenticated>
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-primary" />
                Discover
              </h1>
              <p className="text-muted-foreground mt-1">
                Find your perfect match
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Discover filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={useLocationFilter}
                  onCheckedChange={(checked) => setUseLocationFilter(Boolean(checked))}
                >
                  Location
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={useInterestFilter}
                  onCheckedChange={(checked) => setUseInterestFilter(Boolean(checked))}
                >
                  Interests
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Card Stack */}
          <div className="flex items-center justify-center py-8">
            <div className="relative w-full max-w-sm aspect-[3/4]">
              {loading && <p className="text-center text-muted-foreground">Loading recommendations...</p>}
              {!loading && fetchError && <p className="text-center text-destructive">{fetchError}</p>}
              {!loading && !fetchError && !currentCard && (
                <p className="text-center text-muted-foreground">No candidates found. Update your profile/interests and try again.</p>
              )}
              {!loading && !fetchError && currentCard && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentCard.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      x: direction === "left" ? -200 : direction === "right" ? 200 : 0,
                      rotate: direction === "left" ? -15 : direction === "right" ? 15 : 0,
                    }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <ProfileCard
                      user={currentCard}
                      onLike={handleLike}
                      onPass={handlePass}
                      onSuperLike={handleSuperLike}
                    />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground mt-4">
            <span>← Pass</span>
            <span>⭐ Super Like</span>
            <span>Like →</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
