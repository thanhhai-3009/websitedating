import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck, ShieldX, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

interface ReportDto {
  id: string;
  reporterId: string;
  reasonCategory: string;
  reason: string;
  evidenceUrls: string[];
  status: string;
  createdAt: string;
}

interface ViolationCase {
  userId: string;
  username: string;
  email: string;
  avatarUrl?: string;
  accountStatus: string;
  reportCount: number;
  bannedAt: string;
  reports: ReportDto[];
}

export default function AdminViolations() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading: isLoadingMe, isAdmin } = useCurrentUser();

  const [cases, setCases] = useState<ViolationCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingMe && !isAdmin) navigate("/discover", { replace: true });
  }, [isLoadingMe, isAdmin, navigate]);

  const authFetch = async (url: string, init: RequestInit = {}) => {
    const token = await getToken();
    return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  };

  const fetchCases = async () => {
    if (!isLoaded || !isSignedIn) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/violations`);
      if (!res.ok) throw new Error();
      setCases(await res.json());
    } catch {
      toast({ title: "Failed to load violation cases", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) fetchCases(); }, [isAdmin, isLoaded, isSignedIn]);

  const handleAction = async (userId: string, action: "confirm-ban" | "restore") => {
    setProcessingId(userId);
    try {
      const res = await authFetch(`${API_BASE_URL}/api/admin/violations/${userId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error();
      const label = action === "confirm-ban" ? "permanently banned" : "restored";
      toast({ title: `✅ Account ${label}` });
      setCases(prev => prev.filter(c => c.userId !== userId));
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoadingMe || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 pt-24">
      <Navbar isAuthenticated={true} />
      <main className="container mx-auto px-4 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-xl border border-white/50">

          <div className="flex items-center gap-3 mb-8">
            <ShieldAlert className="w-8 h-8 text-destructive" />
            <div>
              <h1 className="text-2xl font-bold">Violation Queue</h1>
              <p className="text-muted-foreground text-sm">{cases.length} accounts pending review</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading cases...</p>
            </div>
          ) : cases.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No pending violations. All clear!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cases.map(c => (
                <motion.div key={c.userId} layout
                  className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">

                  {/* Header row */}
                  <div className="flex items-center gap-4 p-4">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.username} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive font-bold flex-shrink-0">
                        {c.username?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{c.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>

                    <Badge variant="destructive" className="text-xs flex-shrink-0">
                      {c.reportCount} reports/blocks
                    </Badge>

                    <p className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                      Banned {new Date(c.bannedAt).toLocaleDateString("vi-VN")}
                    </p>

                    {/* Admin actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="destructive"
                        disabled={processingId === c.userId}
                        onClick={() => handleAction(c.userId, "confirm-ban")}
                        className="gap-1 text-xs h-8">
                        <ShieldX className="w-3.5 h-3.5" />
                        Ban
                      </Button>
                      <Button size="sm" variant="outline"
                        disabled={processingId === c.userId}
                        onClick={() => handleAction(c.userId, "restore")}
                        className="gap-1 text-xs h-8 text-green-600 border-green-200 hover:bg-green-50">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Restore
                      </Button>
                    </div>

                    {/* Expand toggle */}
                    <button onClick={() => setExpandedId(expandedId === c.userId ? null : c.userId)}
                      className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                      {expandedId === c.userId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Evidence panel */}
                  <AnimatePresence>
                    {expandedId === c.userId && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2 overflow-hidden">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Reports ({c.reports.length})
                        </p>
                        {c.reports.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No reports — banned by block threshold.</p>
                        ) : (
                          c.reports.map(r => (
                            <div key={r.id} className="bg-white rounded-xl p-3 border border-gray-100 text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs capitalize">{r.reasonCategory?.replace("_", " ")}</Badge>
                                <Badge variant={r.status === "pending" ? "destructive" : "secondary"} className="text-xs">{r.status}</Badge>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                                </span>
                              </div>
                              {r.reason && <p className="text-muted-foreground text-xs">{r.reason}</p>}
                              {r.evidenceUrls?.length > 0 && (
                                <div className="flex gap-2 flex-wrap mt-1">
                                  {r.evidenceUrls.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-primary underline">Evidence {i + 1}</a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
