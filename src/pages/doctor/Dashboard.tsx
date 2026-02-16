import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doctor } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doctor) { setLoading(false); return; }

      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("*, patients(user_id, profiles:user_id(full_name)), hospitals(name)")
        .eq("doctor_id", doctor.id)
        .eq("appointment_date", today)
        .order("appointment_time");

      setAppointments(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const statusColor: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-info/15 text-info",
    completed: "bg-success/15 text-success",
    in_progress: "bg-primary/15 text-primary",
    cancelled: "bg-destructive/15 text-destructive",
  };

  const waiting = appointments.filter((a) => a.status === "approved");
  const inProgress = appointments.filter((a) => a.status === "in_progress");
  const completed = appointments.filter((a) => a.status === "completed");

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Doctor Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning/10 p-2.5"><Clock className="h-5 w-5 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Waiting</p><p className="text-2xl font-bold">{waiting.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">In Progress</p><p className="text-2xl font-bold">{inProgress.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success/10 p-2.5"><Calendar className="h-5 w-5 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold">{completed.length}</p></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Today's Appointments</CardTitle></CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments for today.</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{(a as any).patients?.profiles?.full_name || "Patient"}</p>
                      <p className="text-sm text-muted-foreground">{a.appointment_time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusColor[a.status] || ""}>{a.status}</Badge>
                      {(a.status === "approved" || a.status === "in_progress") && (
                        <Link to={`/doctor/consult?appointment=${a.id}`}>
                          <Button size="sm">Consult</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
