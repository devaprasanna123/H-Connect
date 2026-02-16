import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Stethoscope, Receipt } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ appointments: 0, doctors: 0, patients: 0, revenue: 0 });
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doctor } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      const hospitalId = doctor?.hospital_id;
      if (!hospitalId) { setLoading(false); return; }

      const today = new Date().toISOString().split("T")[0];

      const [apptRes, docRes, todayRes, invRes] = await Promise.all([
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("hospital_id", hospitalId),
        supabase.from("doctors").select("id", { count: "exact", head: true }).eq("hospital_id", hospitalId),
        supabase.from("appointments").select("*, patients(profiles:user_id(full_name)), doctors(profiles:user_id(full_name))").eq("hospital_id", hospitalId).eq("appointment_date", today).order("appointment_time"),
        supabase.from("invoices").select("total").eq("hospital_id", hospitalId).eq("status", "paid"),
      ]);

      const revenue = (invRes.data || []).reduce((sum, inv) => sum + Number(inv.total), 0);
      // Count unique patients from appointments
      const { count: patCount } = await supabase.from("appointments").select("patient_id", { count: "exact", head: true }).eq("hospital_id", hospitalId);

      setStats({
        appointments: apptRes.count || 0,
        doctors: docRes.count || 0,
        patients: patCount || 0,
        revenue,
      });
      setTodayAppts(todayRes.data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Hospital Admin Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5"><Calendar className="h-5 w-5 text-primary" /></div>
            <div><p className="text-sm text-muted-foreground">Total Appointments</p><p className="text-2xl font-bold">{stats.appointments}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-info/10 p-2.5"><Stethoscope className="h-5 w-5 text-info" /></div>
            <div><p className="text-sm text-muted-foreground">Doctors</p><p className="text-2xl font-bold">{stats.doctors}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2.5"><Users className="h-5 w-5 text-success" /></div>
            <div><p className="text-sm text-muted-foreground">Patients</p><p className="text-2xl font-bold">{stats.patients}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2.5"><Receipt className="h-5 w-5 text-warning" /></div>
            <div><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold">${stats.revenue.toFixed(2)}</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Today's Appointments</CardTitle></CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments today.</p>
            ) : (
              <div className="space-y-3">
                {todayAppts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{(a as any).patients?.profiles?.full_name || "Patient"}</p>
                      <p className="text-sm text-muted-foreground">Dr. {(a as any).doctors?.profiles?.full_name} — {a.appointment_time}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">{a.status}</span>
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
