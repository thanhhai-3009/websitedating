import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, Clock, MapPin, MessageCircle, Star, Trash2, Edit, Plus, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useUser, useAuth } from "@clerk/clerk-react";
import { getApiToken } from "@/lib/clerkToken";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  matchName: string;
  matchInitials: string;
  spot: string;
  location: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "completed" | "cancelled" | "incomplete";
  creatorId?: string | null;
  participantId?: string | null;
  scheduledISO?: string | null;
  creatorContinued?: boolean;
  participantContinued?: boolean;
  note?: string;
}

interface DateReviewSummary {
  id: string;
  appointmentId: string;
  updatedAt?: string;
}

interface ResolvedUserResponse {
  id: string;
  clerkId: string;
}

// will be fetched from API

const statusConfig: Record<Appointment["status"], { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-accent/10 text-accent border-accent/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
  incomplete: { label: "Incomplete", className: "bg-muted text-muted-foreground border-border" },
};

const Appointments = () => {
  const navigate = useNavigate();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [matchedUsers, setMatchedUsers] = useState<Array<any>>([]);
  const [editAptRaw, setEditAptRaw] = useState<any | null>(null);
  const [editParticipantName, setEditParticipantName] = useState<string | null>(null);
  const [editCreatorName, setEditCreatorName] = useState<string | null>(null);
  const [editUiStatus, setEditUiStatus] = useState<string>("pending");
  const [selfDbUserId, setSelfDbUserId] = useState<string | null>(null);
  const [reviewsByAppointmentId, setReviewsByAppointmentId] = useState<Record<string, DateReviewSummary>>({});
  const { toast } = useToast();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { user: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const isPremiumUser = Boolean(currentUser?.premiumActive);
  const isAppointmentsLocked = Boolean(user?.id) && !isCurrentUserLoading && !isPremiumUser;

  useEffect(() => {
    let cancelled = false;
    const resolveDbUser = async () => {
      if (!user?.id) {
        setSelfDbUserId(null);
        return;
      }
      try {
        const res = await fetch(`/api/users/resolve/${encodeURIComponent(user.id)}`);
        if (!res.ok) throw new Error("Cannot resolve current user");
        const data = (await res.json()) as ResolvedUserResponse;
        if (!cancelled) {
          setSelfDbUserId(data?.id || null);
        }
      } catch {
        if (!cancelled) {
          setSelfDbUserId(null);
        }
      }
    };
    resolveDbUser();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const loadMyReviews = async (appointmentIds: string[]) => {
    if (!appointmentIds.length) {
      setReviewsByAppointmentId({});
      return;
    }

    try {
      const token = await getApiToken(getToken);
      if (!token) {
        setReviewsByAppointmentId({});
        return;
      }

      const params = new URLSearchParams();
      appointmentIds.forEach((id) => params.append("appointmentIds", id));

      const response = await fetch(`/api/date-reviews/mine?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Cannot load date reviews");
      }

      const reviewList = (await response.json()) as DateReviewSummary[];
      const nextMap: Record<string, DateReviewSummary> = {};
      (reviewList || []).forEach((value) => {
        if (value?.appointmentId) {
          nextMap[value.appointmentId] = value;
        }
      });
      setReviewsByAppointmentId(nextMap);
    } catch {
      setReviewsByAppointmentId({});
    }
  };

  const fetchAppointments = async () => {
    const clerkId = user?.id;
    const currentUserId = selfDbUserId;
    if (!clerkId) return;
    try {
      const [resDb, resClerk] = await Promise.all([
        currentUserId ? fetch(`/api/appointments?userId=${encodeURIComponent(currentUserId)}`) : Promise.resolve(null),
        fetch(`/api/appointments?userId=${encodeURIComponent(clerkId)}`),
      ]);

      const dbData = resDb && resDb.ok ? await resDb.json() : [];
      const clerkData = resClerk.ok ? await resClerk.json() : [];
      const mergedById = new Map<string, any>();
      [...(Array.isArray(dbData) ? dbData : []), ...(Array.isArray(clerkData) ? clerkData : [])].forEach((item) => {
        const key = item?.id || item?._id;
        if (key) {
          mergedById.set(String(key), item);
        }
      });
      const data = Array.from(mergedById.values());
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
      const mapBackendToUI = (s: any): Appointment["status"] => {
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
          case 'incomplete':
            return st as Appointment["status"];
          default:
            return 'pending';
        }
      };

      const matchLookup = new Map<string, string>();
      (mdata || []).forEach((m: any) => {
        const raw = m.displayName || m.username || m.name || "Match";
        const displayName = (raw && raw.normalize) ? raw.normalize('NFC') : raw;
        const keys = [m.clerkId, m.userId, m.id].filter(Boolean).map((k: any) => String(k));
        keys.forEach((k: string) => matchLookup.set(k, displayName));
      });

      const appointmentList = Array.isArray(data) ? data : [];
      // resolve both participant and creator ids that are not present in matchLookup
      const idsToResolve = Array.from(
        new Set(appointmentList
          .flatMap((it: any) => [it?.participantId ? String(it.participantId) : "", it?.creatorId ? String(it.creatorId) : ""]) 
          .filter((id: string) => !!id && !matchLookup.has(id))
        )
      );

      if (idsToResolve.length > 0) {
        const resolved = await Promise.all(
          idsToResolve.map(async (clerkIdToResolve: string) => {
            try {
              const r = await fetch(`/api/users/resolve/${encodeURIComponent(clerkIdToResolve)}`);
              if (!r.ok) return null;
              const u = await r.json();
              const name = u?.username || clerkIdToResolve;
              return {
                clerkId: String(u?.clerkId || clerkIdToResolve),
                userId: u?.id ? String(u.id) : null,
                name,
              };
            } catch {
              return null;
            }
          }),
        );

        resolved.filter(Boolean).forEach((u: any) => {
          matchLookup.set(u.clerkId, u.name);
          if (u.userId) matchLookup.set(u.userId, u.name);
        });
      }

      const mapped = appointmentList.map((it: any) => {
        const scheduled = it.scheduledTime ? new Date(it.scheduledTime) : null;
        const rawParticipantId = it.participantId ? String(it.participantId) : "";
        const rawCreatorId = it.creatorId ? String(it.creatorId) : "";
        const participantName = matchLookup.get(rawParticipantId) || (rawParticipantId ? rawParticipantId : null) || "Match";
        const creatorName = matchLookup.get(rawCreatorId) || (rawCreatorId ? rawCreatorId : null) || null;
        const displayNameCombined = creatorName ? `${creatorName} & ${participantName}` : participantName;
        const normalizeStr = (str: string) => (str && str.normalize) ? str.normalize('NFC') : str;
        const firstGrapheme = (str: string) => {
          const s = normalizeStr(str || '');
          try {
            const arr = Array.from(s);
            return arr.length ? arr[0] : '';
          } catch {
            return s.charAt(0) || '';
          }
        };
        const initials = (participantName.split(" ").map((s: string) => firstGrapheme(s)).slice(0,2).join("") || (participantName.substring(0,2) || "M")).toUpperCase();
        return {
          id: it.id || it._id || "",
          matchName: displayNameCombined,
          matchInitials: initials || "M",
          spot: it.location?.placeName || "",
          location: it.location?.address || "",
          date: scheduled ? format(scheduled, "PPP") : "",
          time: scheduled ? format(scheduled, "p") : "",
          status: mapBackendToUI(it.status),
          creatorId: it.creatorId || null,
          participantId: it.participantId || null,
          creatorName: creatorName,
          participantName: participantName,
          scheduledISO: it.scheduledTime || null,
          creatorContinued: !!it.creatorContinued,
          participantContinued: !!it.participantContinued,
          note: it.note || it.description || "",
        } as Appointment;
      });

      setAppointments(mapped);

      const completedIds = mapped.filter((value) => value.status === "completed").map((value) => value.id);
      await loadMyReviews(completedIds);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAppointmentsLocked) {
      setAppointments([]);
      setReviewsByAppointmentId({});
      return;
    }
    fetchAppointments();
  }, [user, selfDbUserId, isAppointmentsLocked]);

  const now = new Date();

  const parseISO = (s?: string | null) => s ? new Date(s) : null;
  const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 60 * 60 * 1000);

  // classify upcoming vs past with some derived rules:
  // - proposed/pending where scheduledTime passed -> treat as past
  // - otherwise confirmed/pending -> upcoming
  const upcoming = appointments.filter(a => {
    const sched = parseISO(a.scheduledISO);
    if (!sched) return a.status === 'confirmed' || a.status === 'pending' || a.status === 'incomplete';
    const end = addHours(sched, 2);
    // pending where scheduledTime already passed -> past
    if (a.status === 'pending' && now > sched) return false;
    // confirmed but appointment window ended -> past
    if (a.status === 'confirmed' && end && now > end) return false;
    return a.status === 'confirmed' || a.status === 'pending' || a.status === 'incomplete';
  });

  const past = appointments.filter(a => {
    const sched = parseISO(a.scheduledISO);
    const end = sched ? addHours(sched, 2) : null;
    return (
      a.status === 'completed' ||
      a.status === 'cancelled' ||
      (a.status === 'pending' && sched && now > sched) ||
      (a.status === 'confirmed' && end && now > end)
    );
  });

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
                  {/* role-based actions */}
                  {(() => {
                    const sched = parseISO(apt.scheduledISO);
                    const isCreator = Boolean(apt.creatorId) && (
                      String(apt.creatorId) === String(selfDbUserId || "") || String(apt.creatorId) === String(user?.id || "")
                    );
                    const isParticipant = Boolean(apt.participantId) && (
                      String(apt.participantId) === String(selfDbUserId || "") || String(apt.participantId) === String(user?.id || "")
                    );

                    const acceptAppointment = async (id: string) => {
                      try {
                        const resGet = await fetch(`/api/appointments/${encodeURIComponent(id)}`);
                        if (!resGet.ok) throw new Error('Failed to load appointment');
                        const data = await resGet.json();
                        data.status = 'scheduled';
                        await fetch(`/api/appointments/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        toast({ title: 'Accepted', description: 'You accepted the appointment.' });
                        fetchAppointments();
                      } catch (e) {
                        console.error(e);
                        toast({ title: 'Error', description: 'Could not accept appointment.', variant: 'destructive' });
                      }
                    };

                    const sendContinue = async (id: string) => {
                      try {
                        const resGet = await fetch(`/api/appointments/${encodeURIComponent(id)}`);
                        if (!resGet.ok) throw new Error('Failed to load appointment');
                        const data = await resGet.json();
                        if (isCreator) data.creatorContinued = true;
                        if (isParticipant) data.participantContinued = true;
                        await fetch(`/api/appointments/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        toast({ title: 'Continue', description: 'Thanks. Waiting for the other person to continue.' });
                        fetchAppointments();
                      } catch (e) {
                        console.error(e);
                        toast({ title: 'Error', description: 'Could not send continue.', variant: 'destructive' });
                      }
                    };

                    const completeAppointment = async (id: string) => {
                      try {
                        const resGet = await fetch(`/api/appointments/${encodeURIComponent(id)}`);
                        if (!resGet.ok) throw new Error('Failed to load appointment');
                        const data = await resGet.json();
                        data.status = 'completed';
                        await fetch(`/api/appointments/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                        toast({ title: 'Completed', description: 'Thanks for completing the appointment.' });
                        fetchAppointments();
                      } catch (e) {
                        console.error(e);
                        toast({ title: 'Error', description: 'Could not complete appointment.', variant: 'destructive' });
                      }
                    };

                    // Participant sees accept when proposed/pending
                    if (apt.status === 'pending' && isParticipant) {
                      return (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => acceptAppointment(apt.id)}><Plus className="w-3.5 h-3.5" />Accept</Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCancelId(apt.id)}>
                            <Trash2 className="w-3.5 h-3.5" />Cancel
                          </Button>
                        </>
                      );
                    }

                    // Creator sees only cancel while they are the requester
                    if (apt.status === 'pending' && isCreator) {
                      return (
                        <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCancelId(apt.id)}>
                          <Trash2 className="w-3.5 h-3.5" />Cancel
                        </Button>
                      );
                    }

                    // At scheduled time both can continue.
                    if (apt.status === 'confirmed') {
                      const start = sched;
                      const end = start ? addHours(start, 2) : null;
                      const userHasContinued = isCreator ? !!apt.creatorContinued : !!apt.participantContinued;

                      // show Continue only while appointment window is active (start..end)
                      if (start && now >= start && end && now <= end && (!userHasContinued)) {
                        return (
                          <>
                            <Button size="sm" variant="outline" className="gap-1" onClick={() => sendContinue(apt.id)}>Continue</Button>
                            <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCancelId(apt.id)}>Cancel</Button>
                          </>
                        );
                      }

                      // when appointment window ended, allow either creator or participant to complete
                      if (start && end && now > end && (isCreator || isParticipant)) {
                        return (
                          <Button size="sm" variant="gradient" className="gap-1" onClick={() => completeAppointment(apt.id)}>Complete</Button>
                        );
                      }
                    }

                    // default actions: chat + edit + cancel
                    return (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={async () => {
                          try {
                            const res = await fetch(`/api/appointments/${encodeURIComponent(apt.id)}`);
                            if (!res.ok) throw new Error('Failed to load appointment');
                            const data = await res.json();
                                setEditAptRaw(data);
                                const pid = data?.participantId ? String(data.participantId) : null;
                                const cid = data?.creatorId ? String(data.creatorId) : null;
                                if (pid) {
                                  const found = (matchedUsers || []).find((m:any) => {
                                    const ids = [m.clerkId, m.userId, m.id].filter(Boolean).map((v:any) => String(v));
                                    return ids.includes(pid);
                                  });
                                  if (found) {
                                    setEditParticipantName(found.displayName || found.username || found.name || 'Match');
                                  } else {
                                    try {
                                      const ures = await fetch(`/api/users/resolve/${encodeURIComponent(pid)}`);
                                      if (ures.ok) {
                                        const u = await ures.json();
                                        setEditParticipantName(u?.username || u?.displayName || 'Match');
                                      } else {
                                        setEditParticipantName('Match');
                                      }
                                    } catch {
                                      setEditParticipantName('Match');
                                    }
                                  }
                                } else {
                                  setEditParticipantName(null);
                                }
                                if (cid) {
                                  const foundC = (matchedUsers || []).find((m:any) => {
                                    const ids = [m.clerkId, m.userId, m.id].filter(Boolean).map((v:any) => String(v));
                                    return ids.includes(cid);
                                  });
                                  if (foundC) {
                                    const n = (foundC.displayName || foundC.username || foundC.name || null);
                                    setEditCreatorName(n && n.normalize ? n.normalize('NFC') : n);
                                  } else {
                                    try {
                                      const cres = await fetch(`/api/users/resolve/${encodeURIComponent(cid)}`);
                                      if (cres.ok) {
                                        const cu = await cres.json();
                                        const n = cu?.username || cu?.displayName || null;
                                        setEditCreatorName(n && n.normalize ? n.normalize('NFC') : n);
                                      } else {
                                        setEditCreatorName(null);
                                      }
                                    } catch {
                                      setEditCreatorName(null);
                                    }
                                  }
                                } else {
                                  setEditCreatorName(null);
                                }
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
                          const counterpartId = isCreator ? apt.participantId : apt.creatorId;
                          navigate('/messages', { state: { selectedConversationId: counterpartId || apt.matchName } });
                        }}><MessageCircle className="w-3.5 h-3.5" />Chat</Button>

                        <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setCancelId(apt.id)}>
                          <Trash2 className="w-3.5 h-3.5" />Cancel
                        </Button>
                      </>
                    );
                  })()}
                </div>
              )}
              {apt.status === "completed" && (
                <div className="mt-3">
                  <Button size="sm" variant="soft" className="gap-1" asChild>
                    <Link to={`/review/${apt.id}`}>
                      <Star className="w-3.5 h-3.5" />
                      {reviewsByAppointmentId[apt.id] ? "View/Edit Review" : "Write Review"}
                    </Link>
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
      <div className="relative">
      <div className={cn(isAppointmentsLocked && "blur-sm pointer-events-none select-none")}>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
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
              <div className="text-foreground">
                {(editCreatorName || editAptRaw?.creator || editAptRaw?.creatorId || '—') + ' — ' + (editParticipantName || editAptRaw?.participant || editAptRaw?.participantId || '—')}
              </div>
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
      </div>

      {isAppointmentsLocked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 backdrop-blur-[2px] px-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-white">
              <Crown className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Premium required for Appointments</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Upgrade to Premium to unlock appointment management and booking workflows.
            </p>
            <Button className="mt-5" variant="gradient" onClick={() => navigate("/premium")}>
              Upgrade to Premium
            </Button>
          </div>
        </div>
      )}

      {Boolean(user?.id) && isCurrentUserLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <p className="text-sm text-muted-foreground">Checking premium access...</p>
        </div>
      )}
      </div>
    </Layout>
  );
};

export default Appointments;
