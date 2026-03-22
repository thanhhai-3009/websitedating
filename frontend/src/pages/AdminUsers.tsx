import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, Trash2, Mail, Search, AlertCircle, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface User {
  id: string;
  clerkId: string;
  username: string;
  email: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
  profile?: {
    avatarUrl?: string;
  };
}

const AdminUsers = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, isLoading: isLoadingMe, isAdmin } = useCurrentUser();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Guard: redirect if not admin
  useEffect(() => {
    if (!isLoadingMe && !isAdmin) {
      navigate("/discover", { replace: true });
    }
  }, [isLoadingMe, isAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      const token = await getToken();
      const response = await fetch("http://localhost:8080/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching users",
        description: "Make sure you have admin privileges and the backend is running.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${username}"? This will remove them from both the database and Clerk.`)) return;
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:8080/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to delete user");
      toast({ title: "✅ User deleted", description: `"${username}" has been permanently removed.` });
      fetchUsers();
    } catch {
      toast({ title: "Error deleting user", variant: "destructive" });
    }
  };

  const handleRoleChange = async (userId: string, username: string, newRole: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:8080/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: newRole })
      });
      if (!response.ok) throw new Error("Failed to update role");
      toast({ title: "✅ Role updated", description: `"${username}" is now ${newRole}.` });
      fetchUsers();
    } catch {
      toast({ title: "Error updating role", variant: "destructive" });
    }
  };

  if (isLoadingMe) return null;
  if (!isAdmin) return null;

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 pt-24">
      <Navbar isAuthenticated={true} />

      <main className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/50"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                {users.length} registered users
              </p>
            </div>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by username or email..."
                className="pl-10 rounded-full border-gray-200 bg-white/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="border-b border-gray-100 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="pb-3 pt-2 px-3 font-medium w-[220px]">User</th>
                  <th className="pb-3 pt-2 px-3 font-medium w-[220px]">Email</th>
                  <th className="pb-3 pt-2 px-3 font-medium w-[160px]">Role</th>
                  <th className="pb-3 pt-2 px-3 font-medium w-[100px]">Joined</th>
                  <th className="pb-3 pt-2 px-3 font-medium w-[60px] text-right">Del</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>No users found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-gray-50 hover:bg-white/60 transition-colors group"
                    >
                      {/* User */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {user.profile?.avatarUrl ? (
                            <img src={user.profile.avatarUrl} alt={user.username} className="w-9 h-9 rounded-full object-cover shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                              {user.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-foreground text-sm truncate">{user.username}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        {user.id === currentUser?.id ? (
                          <Badge className="gradient-primary border-0 gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            ADMIN (You)
                          </Badge>
                        ) : (
                          <Select
                            defaultValue={user.role || "USER"}
                            onValueChange={(value) => handleRoleChange(user.id, user.username, value)}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs rounded-full border-gray-200 bg-white/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USER">
                                <div className="flex items-center gap-1.5">
                                  <ShieldX className="w-3.5 h-3.5 text-muted-foreground" />
                                  USER
                                </div>
                              </SelectItem>
                              <SelectItem value="ADMIN">
                                <div className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                  ADMIN
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-3 text-right">
                        {user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={`Delete ${user.username}`}
                            onClick={() => handleDeleteUser(user.id, user.username)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminUsers;
