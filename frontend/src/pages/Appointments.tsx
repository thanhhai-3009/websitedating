import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Clock, MapPin, MessageCircle, Star, Trash2, Edit, Plus, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/clerk-react";

interface Appointment {
  id: string;
  matchName: string;
  matchInitials: string;
  spot: string;
  location: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  note?: string;
}

// will be fetched from API

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-accent/10 text-accent border-accent/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Appointments = () => {
  const navigate = useNavigate();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<Array<any>>([]);
  const [editAptRaw, setEditAptRaw] = useState<any | null>(null);
  const [editParticipantName, setEditParticipantName] = useState<string | null>(null);
  const [editUiStatus, setEditUiStatus] = useState<string>("pending");
  const { toast } = useToast();
  const { user } = useUser();

  const fetchAppointments = async () => {
    const clerkId = user?.id;
    if (!clerkId) return;
    try {
      const res = await fetch(`/api/appointments?userId=${encodeURIComponent(clerkId)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // also fetch matched users so we can resolve participantId -> display name
      let mdata: any[] = [];
      try {
        const mres = await fetch(`/api/discovery/matches?clerkId=${encodeURIComponent(clerkId)}&limit=200`);
        if (mres.ok) {
          mdata = await mres.json();
          setMatchedUsers(mdata || []);
        }
      } catch (e) {
        console.error('Could not load matches', e);
      }

      // normalize server shape to UI shape
      const mapBackendToUI = (s: any) => {
        if (!s) return 'pending';
        const st = String(s).toLowerCase();
        switch (st) {
          case 'scheduled':
            return 'confirmed';
          case 'proposed':
            return 'pending';
          case 'canceled':
          case 'cancelled':
            return 'cancelled';
          case 'completed':
            return 'completed';
          case 'pending':
          case 'confirmed':
            return st;
          default:
            return st;
        }
      };

      // build a quick lookup from matchedUsers returned above
      // build a quick lookup from matches we just fetched (use local mdata to avoid stale state)
      const matchLookup = new Map<string, string>();
      (mdata || []).forEach((m: any) => {
        const id = m.clerkId ?? m.userId ?? m.id ?? null;
        if (id) matchLookup.set(String(id), m.displayName || m.username || m.name || String(id));
      });

      const mapped = (data || []).map((it: any) => {
        const scheduled = it.scheduledTime ? new Date(it.scheduledTime) : null;
        const rawParticipantId = it.participantId ? String(it.participantId) : "";
        const resolvedName = matchLookup.get(rawParticipantId) || rawParticipantId || "Match";
        const initials = resolvedName.split(" ").map((s: string) => s[0]).slice(0, 2).join("") || (resolvedName.substring(0, 2) || "M");
        return {
          id: it.id || it._id || "",
          matchName: resolvedName,
          matchInitials: initials || "M",
          spot: it.location?.placeName || "",
          location: it.location?.address || "",
          date: scheduled ? format(scheduled, "PPP") : "",
          time: scheduled ? format(scheduled, "p") : "",
          status: mapBackendToUI(it.status),
          note: it.note || it.description || "",
        } as Appointment;
      });
      setAppointments(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchAppointments(); }, [user]);

  const upcoming = appointments.filter(a => a.status === "confirmed" || a.status === "pending");
  const past = appointments.filter(a => a.status === "completed" || a.status === "cancelled");
  const pendingReviews = appointments.filter(a => a.status === "completed" && !isReviewed(a.id));

  const handleCancel = () => {
    if (!cancelId) return;
    fetch(`/api/appointments/${cancelId}`, { method: 'DELETE' }).then(res => {
      if (!res.ok) throw new Error('Delete failed');
      toast({ title: "Appointment cancelled", description: "Your date has been cancelled." });
      setCancelId(null);
      fetchAppointments();
    }).catch(err => {
      console.error(err);
      toast({ title: "Error", description: "Could not cancel appointment.", variant: 'destructive' });
    });
  };

  const AppointmentCard = ({ apt, showActions }: { apt: Appointment; showActions: boolean }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="gradient-card hover:shadow-md transition-all">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="gradient-primary text-primary-foreground">{apt.matchInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif font-semibold text-foreground">{apt.matchName}</h3>
                <Badge variant="outline" className={statusConfig[apt.status].className}>
                  {statusConfig[apt.status].label}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{apt.spot} — {apt.location}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{apt.date}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{apt.time}</span>
                </div>
              </div>
              {apt.note && (
                <p className="text-sm text-muted-foreground mt-2 italic">"{apt.note}"</p>
              )}
              {showActions && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                    try {
                      const res = await fetch(`/api/appointments/${encodeURIComponent(apt.id)}`);
                      if (!res.ok) throw new Error('Failed to load appointment');
                      const data = await res.json();
                      setEditAptRaw(data);
                      // resolve participant name from matchedUsers (if available)
                      const pid = data?.participantId ? String(data.participantId) : null;
                      if (pid) {
                        const found = (matchedUsers || []).find((m: any) => String(m.clerkId ?? m.userId ?? m.id) === pid);
                        setEditParticipantName(found ? (found.displayName || found.username || found.name) : pid);
                      } else {
                        setEditParticipantName(null);
                      }
                      // map backend status to UI status for selection
                      const ui = (s: any) => {
                        if (!s) return 'pending';
                        const st = String(s).toLowerCase();
                        if (st === 'scheduled') return 'confirmed';
                        if (st === 'proposed') return 'pending';
                        if (st === 'canceled' || st === 'cancelled') return 'cancelled';
                        return st;
                      };
                      setEditUiStatus(ui(data.status));
                    } catch (e) {
                      console.error(e);
                      toast({ title: 'Error', description: 'Could not load appointment for editing.', variant: 'destructive' });
                    }
                  }}><Edit className="w-3.5 h-3.5" />Edit</Button>

                  <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                    // navigate to messages, preselect conversation by id
                    navigate('/messages', { state: { selectedConversationId: apt.matchName } });
                  }}><MessageCircle className="w-3.5 h-3.5" />Chat</Button>

                  <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCancelId(apt.id)}>
                    <Trash2 className="w-3.5 h-3.5" />Cancel
                  </Button>
                </div>
              )}
              {apt.status === "completed" && !isReviewed(apt.id) && (
                <div className="mt-3">
                  <Button size="sm" variant="soft" className="gap-1" asChild>
                    <Link to={`/review/${apt.id}`}><Star className="w-3.5 h-3.5" />Leave Review</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Layout isAuthenticated>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── Trigger: Review reminder banner ── */}
          {pendingReviews.map(apt => (
            <motion.div
              key={apt.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
            >
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <p className="flex-1 text-sm text-foreground">
                Cuộc hẹn với <span className="font-semibold">{apt.matchName}</span> đã kết thúc. Hãy để lại đánh giá!
              </p>
              <Button size="sm" variant="gradient" asChild>
                <Link to={`/review/${apt.id}`}><Star className="w-3.5 h-3.5 mr-1" />Đánh giá</Link>
              </Button>
            </motion.div>
          ))}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-2">My Appointments</h1>
              <p className="text-muted-foreground">Manage your upcoming and past dates</p>
            </div>
            <Button variant="gradient" asChild>
              <Link to="/appointments/book"><Plus className="w-4 h-4 mr-2" />Book New</Link>
            </Button>
          </div>

          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="w-full">
              <TabsTrigger value="upcoming" className="flex-1">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="past" className="flex-1">Past ({past.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="space-y-4">
              {upcoming.length > 0 ? upcoming.map(apt => (
                <AppointmentCard key={apt.id} apt={apt} showActions />
              )) : (
                <div className="text-center py-12">
                  <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-serif text-lg text-foreground mb-1">No upcoming dates</h3>
                  <p className="text-muted-foreground mb-4">Book a date with one of your matches!</p>
                  <Button variant="gradient" asChild><Link to="/date-spots">Browse Date Spots</Link></Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="space-y-4">
              {past.map(apt => (
                <AppointmentCard key={apt.id} apt={apt} showActions={false} />
              ))}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelId !== null} onOpenChange={() => setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Cancel Appointment</DialogTitle>
            <DialogDescription>Are you sure you want to cancel this date? Your match will be notified.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>Keep Date</Button>
            <Button variant="destructive" onClick={handleCancel}>Cancel Date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editAptRaw !== null} onOpenChange={() => setEditAptRaw(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Appointment</DialogTitle>
            <DialogDescription>Update appointment status. You can also modify details in this dialog.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Match</label>
              <div className="text-foreground">{editParticipantName || editAptRaw?.participant || editAptRaw?.participantId || '—'}</div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Place</label>
              <div className="text-foreground">{editAptRaw?.location?.placeName || '—'}</div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Scheduled</label>
              <div className="text-foreground">{editAptRaw?.scheduledTime ? new Date(editAptRaw.scheduledTime).toLocaleString() : '—'}</div>
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Status</label>
              <select className="w-full p-2 border rounded" value={editUiStatus} onChange={(e) => setEditUiStatus(e.target.value)}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAptRaw(null)}>Close</Button>
            <Button variant="gradient" onClick={async () => {
              if (!editAptRaw) return;
              const mapUIToBackend = (ui: string) => {
                const s = String(ui).toLowerCase();
                switch (s) {
                  case 'confirmed': return 'scheduled';
                  case 'pending': return 'proposed';
                  case 'cancelled': return 'canceled';
                  case 'completed': return 'completed';
                  default: return s;
                }
              };
              const updated = { ...editAptRaw, status: mapUIToBackend(editUiStatus) };
              try {
                const res = await fetch(`/api/appointments/${encodeURIComponent(editAptRaw.id)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updated),
                });
                if (!res.ok) throw new Error('Update failed');
                toast({ title: 'Saved', description: 'Appointment updated.' });
                setEditAptRaw(null);
                fetchAppointments();
              } catch (e) {
                console.error(e);
                toast({ title: 'Error', description: 'Could not update appointment.', variant: 'destructive' });
              }
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Appointments;
