import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Search, FileText, Image as ImageIcon } from "lucide-react";

export default function PatientRecords() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doctor } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doctor) { setLoading(false); return; }

      // Get patients this doctor has consulted
      const { data: cons } = await supabase.from("consultations").select("patient_id").eq("doctor_id", doctor.id);
      const patientIds = [...new Set((cons || []).map((c) => c.patient_id))];

      if (patientIds.length > 0) {
        const { data: pats } = await supabase.from("patients").select("*, profiles:user_id(full_name, phone)").in("id", patientIds);
        setPatients(pats || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const selectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    const { data } = await supabase
      .from("consultations")
      .select("*, appointments(appointment_date), prescriptions(*)")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false });
    setConsultations(data || []);
  };

  const filtered = patients.filter((p) =>
    (p.profiles?.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Patient Records</h1>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patients..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Patient List */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No patient records found.</p>
            ) : (
              filtered.map((p) => (
                <Card key={p.id} className={`cursor-pointer transition-colors hover:bg-secondary/50 ${selectedPatient?.id === p.id ? "ring-2 ring-primary" : ""}`} onClick={() => selectPatient(p)}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div>
                      <p className="font-medium">{p.profiles?.full_name || "Patient"}</p>
                      <p className="text-sm text-muted-foreground">{p.gender || ""} {p.age ? `• ${p.age} yrs` : ""}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Consultation History */}
          <div>
            {selectedPatient ? (
              <div className="space-y-3">
                <h3 className="font-semibold">History for {selectedPatient.profiles?.full_name}</h3>
                {consultations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No consultations found.</p>
                ) : (
                  consultations.map((c) => (
                    <Card key={c.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">
                          {c.appointments?.appointment_date ? format(new Date(c.appointments.appointment_date), "MMM dd, yyyy") : ""}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        {c.observations && <p>{c.observations}</p>}

                        {/* Handwritten Prescription */}
                        {(c.prescription_image_url || c.prescription_text) && (
                          <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
                            <p className="text-xs font-medium flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Handwritten Prescription
                            </p>

                            {c.prescription_image_url && (
                              <a
                                href={c.prescription_image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-block"
                              >
                                <div className="relative overflow-hidden rounded border transition-all group-hover:shadow-md">
                                  <img
                                    src={c.prescription_image_url}
                                    alt="Handwritten prescription"
                                    className="max-h-32 w-auto object-contain"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/10">
                                    <ImageIcon className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-70" />
                                  </div>
                                </div>
                              </a>
                            )}

                            {c.prescription_text && (
                              <p className="whitespace-pre-wrap text-xs bg-background rounded p-1.5 border">
                                {c.prescription_text}
                              </p>
                            )}
                          </div>
                        )}

                        {c.prescriptions?.length > 0 && (
                          <div className="text-xs space-y-1">
                            {c.prescriptions.map((rx: any) => (
                              <span key={rx.id} className="mr-2 inline-block rounded bg-secondary px-2 py-0.5">
                                {rx.medicine_name} {rx.dosage}
                              </span>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a patient to view their records.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
