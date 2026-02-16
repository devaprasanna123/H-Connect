import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, FileText, Receipt } from "lucide-react";
import { format } from "date-fns";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Get patient record
      const { data: patient } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!patient) { setLoading(false); return; }

      const [apptRes, invRes] = await Promise.all([
        supabase.from("appointments").select("*, doctors(specialty, profiles:user_id(full_name)), hospitals(name)").eq("patient_id", patient.id).order("appointment_date", { ascending: false }).limit(10),
        supabase.from("invoices").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(5),
      ]);

      // Get consultations for prescriptions
      const { data: consultations } = await supabase.from("consultations").select("id").eq("patient_id", patient.id);
      if (consultations && consultations.length > 0) {
        const cIds = consultations.map((c) => c.id);
        const { data: rxData } = await supabase.from("prescriptions").select("*").in("consultation_id", cIds).order("created_at", { ascending: false }).limit(5);
        setPrescriptions(rxData || []);
      }

      setAppointments(apptRes.data || []);
      setInvoices(invRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const upcoming = appointments.filter((a) => new Date(a.appointment_date) >= new Date() && a.status !== "cancelled" && a.status !== "completed");
  const past = appointments.filter((a) => a.status === "completed");

  const statusColor: Record<string, string> = {
    pending: "bg-warning/15 text-warning border-warning/20",
    approved: "bg-info/15 text-info border-info/20",
    completed: "bg-success/15 text-success border-success/20",
    cancelled: "bg-destructive/15 text-destructive border-destructive/20",
    in_progress: "bg-primary/15 text-primary border-primary/20",
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Patient Dashboard</h1>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5"><Calendar className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Upcoming</p><p className="text-2xl font-bold">{upcoming.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success/10 p-2.5"><Clock className="h-5 w-5 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Past Visits</p><p className="text-2xl font-bold">{past.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-info/10 p-2.5"><FileText className="h-5 w-5 text-info" /></div>
              <div><p className="text-sm text-muted-foreground">Prescriptions</p><p className="text-2xl font-bold">{prescriptions.length}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning/10 p-2.5"><Receipt className="h-5 w-5 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Invoices</p><p className="text-2xl font-bold">{invoices.length}</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader><CardTitle>Upcoming Appointments</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments. Book one now!</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{(a as any).hospitals?.name || "Hospital"}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(a.appointment_date), "MMM dd, yyyy")} at {a.appointment_time}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColor[a.status] || ""}>{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">${Number(inv.total).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(inv.created_at), "MMM dd, yyyy")}</p>
                    </div>
                    <Badge variant="outline" className={inv.status === "paid" ? statusColor.completed : statusColor.pending}>{inv.status}</Badge>
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
