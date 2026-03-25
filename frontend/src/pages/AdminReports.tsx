import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ShieldAlert, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Gavel, 
  ChevronLeft,
  ExternalLink,
  MessageSquare,
  Clock,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/Navbar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getApiToken } from "@/lib/clerkToken";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isBanned: boolean;
}

interface Report {
  id: string;
  reasonCategory: string;
  reason: string;
  evidenceUrls: string[];
  isUrgent: boolean;
  status: "pending" | "resolved";
  createdAt: string;
  reporter: UserInfo;
  reportedUser: UserInfo;
}

const AdminReports = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, isLoading: isLoadingMe, isAdmin } = useCurrentUser();

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");

  // Guard: redirect if not admin
  useEffect(() => {
    if (!isLoadingMe && !isAdmin) {
      navigate("/discover", { replace: true });
    }
  }, [isLoadingMe, isAdmin, navigate]);

  const fetchReports = async (status: string) => {
    setIsLoading(true);
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/admin/reports?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch reports");
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error fetching reports",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchReports(filter);
  }, [isAdmin, filter]);

  const updateReportStatus = async (reportId: string, status: "resolved") => {
    try {
      const token = await getApiToken(getToken);
      const response = await fetch(`http://localhost:8080/api/admin/reports/${reportId}/resolve`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error("Failed to resolve report");
      toast({ title: "Report updated", description: `Report has been marked as ${status}.` });
      fetchReports(filter);
    } catch (error) {
      console.error(error);
      toast({ title: "Error resolving report", variant: "destructive" });
    }
  };

  const handleResolveReport = (reportId: string) => {
    updateReportStatus(reportId, "resolved");
  };

  const handleBanUserFromReport = async (userId: string, username: string, reportId: string) => {
    const reason = window.prompt(`Enter ban reason for "${username}":`, "Violation of community guidelines based on user report");
    if (reason === null) return;
    try {
      const token = await getApiToken(getToken);
      // Ban the user
      const banResponse = await fetch(`http://localhost:8080/api/admin/users/${userId}/ban`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason })
      });
      
      if (!banResponse.ok) throw new Error("Failed to ban user");

      // Then resolve the report
      const resolveResponse = await fetch(`http://localhost:8080/api/admin/reports/${reportId}/resolve`, {
        method: "PATCH",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "resolved" })
      });

      if (!resolveResponse.ok) throw new Error("Failed to resolve report after ban");

      toast({ title: "✅ Action complete", description: `"${username}" has been banned and report resolved.` });
      fetchReports(filter);
    } catch (error) {
      console.error(error);
      toast({ title: "Error taking action", variant: "destructive" });
    }
  };

  if (isLoadingMe) return null;
  if (!isAdmin) return null;

  const filteredReports = reports.filter(r =>
    r.reportedUser?.username?.toLowerCase().includes(search.toLowerCase()) ||
    r.reporter?.username?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
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
              <button 
                onClick={() => navigate("/admin/users")}
                className="text-sm text-primary flex items-center gap-1 hover:underline mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Users
              </button>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-primary" />
                User Reports
              </h1>
              <p className="text-muted-foreground mt-1">
                Review and resolve community reports
              </p>
            </div>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                className="pl-10 rounded-full border-gray-200 bg-white/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Tabs defaultValue="pending" className="space-y-6" onValueChange={setFilter}>
            <TabsList className="bg-muted/50 p-1 rounded-full">
              <TabsTrigger value="pending" className="rounded-full px-6">Pending</TabsTrigger>
              <TabsTrigger value="resolved" className="rounded-full px-6">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="space-y-4">
              {isLoading ? (
                <div className="py-20 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading reports...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="py-20 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <CheckCircle2 className="w-12 h-12 text-success/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">All clear! No pending reports found.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredReports.map((report) => (
                    <motion.div
                      key={report.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "p-5 rounded-2xl border transition-all",
                        report.isUrgent ? "bg-red-50/30 border-red-100 shadow-sm" : "bg-white border-gray-100"
                      )}
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Reporter & Reported */}
                        <div className="flex-shrink-0 w-full md:w-48 space-y-4">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reporter</span>
                            <div className="flex items-center gap-2">
                              {report.reporter?.avatarUrl ? (
                                <img src={report.reporter.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="avatar" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                  <UserIcon className="w-3 h-3 text-gray-400" />
                                </div>
                              )}
                              <span className="text-sm font-medium truncate">{report.reporter?.username}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reported User</span>
                            <div className="flex items-center gap-2">
                               {report.reportedUser?.avatarUrl ? (
                                <img src={report.reportedUser.avatarUrl} className="w-6 h-6 rounded-full object-cover" alt="avatar" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center">
                                  <UserIcon className="w-3 h-3 text-primary/40" />
                                </div>
                              )}
                              <span className="text-sm font-medium truncate">{report.reportedUser?.username}</span>
                              {report.reportedUser?.isBanned && (
                                <Badge variant="destructive" className="px-1.5 py-0 text-[10px] h-4">BANNED</Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Report Detail */}
                        <div className="flex-grow space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/10 text-primary border-0 hover:bg-primary/20">
                                {report.reasonCategory?.replace('_', ' ')}
                              </Badge>
                              {report.isUrgent && (
                                <Badge variant="destructive" className="animate-pulse">URGENT</Badge>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(report.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 bg-gray-50/50 rounded-xl text-sm italic text-foreground/80 flex gap-2">
                            <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p>"{report.reason || 'No detailed reason provided.'}"</p>
                          </div>

                          {report.status === "pending" && (
                            <div className="flex items-center gap-2 pt-1">
                              <Button 
                                size="sm" 
                                className="rounded-full gap-2 gradient-primary border-0"
                                onClick={() => handleBanUserFromReport(report.reportedUser.id, report.reportedUser.username, report.id)}
                              >
                                <Gavel className="w-3.5 h-3.5" />
                                Ban User
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="rounded-full gap-2 border-primary/20 text-primary hover:bg-primary/5"
                                onClick={() => handleResolveReport(report.id)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Resolve
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminReports;

