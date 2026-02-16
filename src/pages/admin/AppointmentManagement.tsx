import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AppointmentManagement() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async (hId: string) => {
    let query = supabase
      .from("appointments")
      .select("*, patients(profiles:user_id(full_name)), doctors(specialty, profiles:user_id(full_name))")
      .eq("hospital_id", hId)
      .order("appointment_date", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter as any);
    }

    const { data } = await query.limit(50);
    setAppointments(data || []);
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doc } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      if (doc?.hospital_id) {
        setHospitalId(doc.hospital_id);
        await fetchAppointments(doc.hospital_id);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  useEffect(() => {
    if (hospitalId) fetchAppointments(hospitalId);
  }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status: status as any }).eq("id", id);
    toast.success(`Appointment ${status}`);
    if (hospitalId) fetchAppointments(hospitalId);
  };

  const statusColor: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-info/15 text-info",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
    in_progress: "bg-primary/15 text-primary",
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Appointment Management</h1>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {appointments.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No appointments found.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{(a as any).patients?.profiles?.full_name || "Patient"}</p>
                    <p className="text-sm text-muted-foreground">
                      Dr. {(a as any).doctors?.profiles?.full_name} — {format(new Date(a.appointment_date), "MMM dd, yyyy")} at {a.appointment_time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColor[a.status] || ""}>{a.status}</Badge>
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(a.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => updateStatus(a.id, "cancelled")}>Cancel</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
