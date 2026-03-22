import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface CurrentUser {
  id: string;
  clerkId: string;
  username: string;
  email: string;
  role: string;
  premiumPlan?: string;
  premiumExpiresAt?: string;
  premiumActive?: boolean;
}

export function useCurrentUser() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const fetchMe = async () => {
      try {
        const token = await getToken();

        if (!token) {
          setUser(null);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json() as CurrentUser;
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();

    return () => {
      controller.abort();
    };
  }, [getToken, isLoaded, isSignedIn]);

  return { user, isLoading, isAdmin: user?.role === "ADMIN" };
}
