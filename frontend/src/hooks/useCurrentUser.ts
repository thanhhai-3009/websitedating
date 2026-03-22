import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

interface CurrentUser {
  id: string;
  clerkId: string;
  username: string;
  email: string;
  role: string;
}

export function useCurrentUser() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }

    const fetchMe = async () => {
      try {
        const token = await getToken();
        const res = await fetch("http://localhost:8080/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json() as CurrentUser;
          setUser(data);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMe();
  }, [isLoaded, isSignedIn]);

  return { user, isLoading, isAdmin: user?.role === "ADMIN" };
}
