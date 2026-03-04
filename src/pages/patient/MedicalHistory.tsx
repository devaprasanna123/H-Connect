import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Image as ImageIcon } from "lucide-react";

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

                  {/* Handwritten Prescription */}
                  {(c.prescription_image_url || c.prescription_text) && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Handwritten Prescription
                      </p>

                      {c.prescription_image_url && (
                        <div>
                          <a
                            href={c.prescription_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-block"
                          >
                            <div className="relative overflow-hidden rounded-lg border transition-all group-hover:shadow-md">
                              <img
                                src={c.prescription_image_url}
                                alt="Handwritten prescription"
                                className="max-h-48 w-auto object-contain transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/10">
                                <ImageIcon className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-70" />
                              </div>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Click to view full size</p>
                          </a>
                        </div>
                      )}

                      {c.prescription_text && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Extracted Text:</p>
                          <p className="whitespace-pre-wrap text-sm bg-background rounded p-2 border">
                            {c.prescription_text}
                          </p>
                        </div>
                      )}
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
