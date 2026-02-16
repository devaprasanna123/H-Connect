import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function MedicalHistory() {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: patient } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!patient) { setLoading(false); return; }

      const { data } = await supabase
        .from("consultations")
        .select("*, appointments(appointment_date, appointment_time, hospitals(name)), doctors(specialty, profiles:user_id(full_name)), prescriptions(*)")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false });

      setConsultations(data || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Medical History</h1>
        {consultations.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No consultation history yet.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {consultations.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {(c as any).doctors?.profiles?.full_name || "Doctor"} — {(c as any).doctors?.specialty}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {c.appointments?.appointment_date ? format(new Date(c.appointments.appointment_date), "MMM dd, yyyy") : ""}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{(c as any).appointments?.hospitals?.name}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.observations && (
                    <div>
                      <p className="text-sm font-medium">Observations</p>
                      <p className="text-sm text-muted-foreground">{c.observations}</p>
                    </div>
                  )}
                  {c.prescriptions && c.prescriptions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Prescriptions</p>
                      <div className="rounded-lg border">
                        <table className="w-full text-sm">
                          <thead><tr className="border-b bg-secondary/50"><th className="p-2 text-left">Medicine</th><th className="p-2 text-left">Dosage</th><th className="p-2 text-left">Duration</th></tr></thead>
                          <tbody>
                            {c.prescriptions.map((p: any) => (
                              <tr key={p.id} className="border-b last:border-0"><td className="p-2">{p.medicine_name}</td><td className="p-2">{p.dosage}</td><td className="p-2">{p.duration}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
