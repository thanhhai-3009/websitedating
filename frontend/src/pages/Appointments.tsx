import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, Clock, MapPin, MessageCircle, Star, Trash2, Edit, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  title?: string;
  spot?: string;
  location?: string;
  scheduledTime?: string; // ISO
  status?: string;
  note?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  pending: { label: "Pending", className: "bg-accent/10 text-accent border-accent/20" },
  completed: { label: "Completed", className: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Appointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/appointments')
      .then(res => res.json())
      .then((data: any[]) => {
        const mapped = data.map(a => ({
          id: a.id,
          title: a.title,
          spot: a.location || (a.place != null ? a.place.placeName : undefined),
          location: a.location || (a.place != null ? a.place.address : undefined),
          scheduledTime: a.scheduledTime,
          status: a.status || 'confirmed',
          note: a.note,
        }));
        setAppointments(mapped);
      }).catch(() => setAppointments([]));
  }, []);

  const handleDelete = (id: string) => {
    fetch(`/api/appointments/${id}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          setAppointments(prev => prev.filter(a => a.id !== id));
          toast({ title: 'Appointment cancelled', description: 'Your date has been cancelled.' });
        } else {
          toast({ title: 'Failed', description: 'Could not cancel appointment', variant: 'destructive' });
        }
      }).catch(() => toast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' }));
  };

  const upcoming = appointments.filter(a => !a.status || a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'pending');
  const past = appointments.filter(a => a.status === 'completed' || a.status === 'cancelled');

  const AppointmentCard = ({ apt, showActions }: { apt: Appointment; showActions: boolean }) => {
    const dt = apt.scheduledTime ? new Date(apt.scheduledTime) : null;
    const dateStr = dt ? dt.toLocaleDateString() : '';
    const timeStr = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="gradient-card hover:shadow-md transition-all">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="gradient-primary text-primary-foreground">{(apt.title || 'D').charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-serif font-semibold text-foreground">{apt.title || apt.spot}</h3>
                  <Badge variant="outline" className={statusConfig[apt.status || 'confirmed'].className}>
                    {statusConfig[apt.status || 'confirmed'].label}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{apt.spot} — {apt.location}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{dateStr}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{timeStr}</span>
                  </div>
                </div>
                {apt.note && (
                  <p className="text-sm text-muted-foreground mt-2 italic">"{apt.note}"</p>
                )}
                {showActions && (
                  <div className="flex gap-2 mt-3">
                      <Link to={`/appointments/book?id=${apt.id}`} className="">
                        <Button size="sm" variant="outline" className="gap-1"><Edit className="w-3.5 h-3.5" />Edit</Button>
                      </Link>
                      <Button size="sm" variant="outline" className="gap-1"><MessageCircle className="w-3.5 h-3.5" />Chat</Button>
                      <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(apt.id)}>
                        <Trash2 className="w-3.5 h-3.5" />Cancel
                      </Button>
                    </div>
                )}
                {apt.status === "completed" && (
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
  };

  return (
    <Layout isAuthenticated>
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
    </Layout>
  );
};

export default Appointments;
