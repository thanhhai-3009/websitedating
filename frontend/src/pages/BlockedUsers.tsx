import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldBan, 
  UserX, 
  Trash2, 
  ChevronLeft,
  User as UserIcon,
  Search,
  ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";
import { getApiToken } from "@/lib/clerkToken";

interface BlockedUser {
  id: string;
  username: string;
  avatarUrl: string;
}

export default function BlockedUsers() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchBlockedUsers = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/moderation/blocked-users?clerkId=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch blocked users");
      const data = await response.json();
      setBlockedUsers(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error loading blocked list",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [user?.id]);

  const handleUnblock = async (targetUserId: string, username: string) => {
    if (!user?.id) return;
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/moderation/block?clerkId=${user.id}&targetUserId=${targetUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to unblock");
      
      toast({
        title: "User unblocked",
        description: `${username} has been removed from your blocked list.`
      });
      
      // Update local state
      setBlockedUsers(prev => prev.filter(u => u.id !== targetUserId));
    } catch (error) {
      toast({
        title: "Error unblocking",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = blockedUsers.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-20">
      <Navbar isAuthenticated={true} />
      
      <main className="container mx-auto px-4 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-gray-100"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <button 
                onClick={() => navigate("/profile")}
                className="text-sm text-primary flex items-center gap-1 hover:underline mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Profile
              </button>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ShieldBan className="w-6 h-6 text-primary" />
                Blocked Users
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Manage the users you've blocked from contacting you.
              </p>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search blocked users..."
              className="pl-10 rounded-full border-gray-100 bg-gray-50 focus-visible:ring-primary/20 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-20 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground text-sm">Loading blocked list...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <ShieldCheck className="w-12 h-12 text-primary/20 mx-auto mb-3" />
                <p className="text-muted-foreground">Your blocked list is empty.</p>
              </div>
            ) : (
              <AnimatePresence>
                {filteredUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, x: -20 }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-primary/20 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt={u.username} />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center border-2 border-white shadow-sm">
                          <UserIcon className="w-6 h-6 text-primary/30" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-gray-900">{u.username}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Blocked User</p>
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleUnblock(u.id, u.username)}
                      className="rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Unblock
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-8 px-8">
          Unblocking someone allows them to find you in Discover again. 
          Old connections will not be restored automatically.
        </p>
      </main>
    </div>
  );
}
