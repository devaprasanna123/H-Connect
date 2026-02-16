import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle } from "lucide-react";

interface PrescriptionEntry {
  medicine_name: string;
  dosage: string;
  duration: string;
}

export default function ConsultationPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointment");
  const [appointment, setAppointment] = useState<any>(null);
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [observations, setObservations] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionEntry[]>([
    { medicine_name: "", dosage: "", duration: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appointmentId || !user) { setLoading(false); return; }
    const fetch = async () => {
      const { data: appt } = await supabase
        .from("appointments")
        .select("*, patients(*, profiles:user_id(full_name, phone)), hospitals(name)")
        .eq("id", appointmentId)
        .maybeSingle();

      if (appt) {
        setAppointment(appt);
        setPatientDetails((appt as any).patients);
      }
      setLoading(false);
    };
    fetch();
  }, [appointmentId, user]);

  const addPrescription = () => setPrescriptions([...prescriptions, { medicine_name: "", dosage: "", duration: "" }]);
  const removePrescription = (i: number) => setPrescriptions(prescriptions.filter((_, idx) => idx !== i));
  const updatePrescription = (i: number, field: keyof PrescriptionEntry, value: string) => {
    const updated = [...prescriptions];
    updated[i][field] = value;
    setPrescriptions(updated);
  };

  const handleSubmit = async () => {
    if (!user || !appointment) return;
    setSaving(true);

    const { data: doctor } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
    if (!doctor) { toast.error("Doctor record not found"); setSaving(false); return; }

    // Create consultation
    const { data: consultation, error: cErr } = await supabase.from("consultations").insert({
      appointment_id: appointment.id,
      doctor_id: doctor.id,
      patient_id: appointment.patient_id,
      observations,
    }).select().single();

    if (cErr) { toast.error("Failed: " + cErr.message); setSaving(false); return; }

    // Insert prescriptions
    const validRx = prescriptions.filter((p) => p.medicine_name.trim());
    if (validRx.length > 0) {
      await supabase.from("prescriptions").insert(
        validRx.map((p) => ({ ...p, consultation_id: consultation.id }))
      );
    }

    // Mark appointment as completed
    await supabase.from("appointments").update({ status: "completed" as any }).eq("id", appointment.id);

    toast.success("Consultation saved!");
    setSaved(true);
    setSaving(false);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  if (!appointmentId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Consultations</h1>
          <p className="text-muted-foreground">Select an appointment from the dashboard to start a consultation.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (saved) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="mb-4 h-16 w-16 text-success" />
          <h2 className="mb-2 text-2xl font-bold">Consultation Complete</h2>
          <p className="text-muted-foreground">The appointment has been marked as completed.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Consultation</h1>

        {/* Patient Info */}
        {patientDetails && (
          <Card>
            <CardHeader><CardTitle>Patient Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div><span className="font-medium">Name:</span> {patientDetails.profiles?.full_name}</div>
                <div><span className="font-medium">Phone:</span> {patientDetails.profiles?.phone || "N/A"}</div>
                <div><span className="font-medium">Gender:</span> {patientDetails.gender || "N/A"}</div>
                <div><span className="font-medium">Age:</span> {patientDetails.age || "N/A"}</div>
                <div><span className="font-medium">Blood Group:</span> {patientDetails.blood_group || "N/A"}</div>
                <div><span className="font-medium">Allergies:</span> {patientDetails.allergies || "None"}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observations */}
        <Card>
          <CardHeader><CardTitle>Observations</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Enter clinical observations..." rows={4} />
          </CardContent>
        </Card>

        {/* Prescriptions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prescriptions</CardTitle>
            <Button size="sm" variant="outline" onClick={addPrescription}><Plus className="mr-1 h-4 w-4" />Add</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {prescriptions.map((p, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Medicine</Label>
                  <Input value={p.medicine_name} onChange={(e) => updatePrescription(i, "medicine_name", e.target.value)} placeholder="Medicine name" />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Dosage</Label>
                  <Input value={p.dosage} onChange={(e) => updatePrescription(i, "dosage", e.target.value)} placeholder="e.g., 500mg" />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Duration</Label>
                  <Input value={p.duration} onChange={(e) => updatePrescription(i, "duration", e.target.value)} placeholder="e.g., 7 days" />
                </div>
                {prescriptions.length > 1 && (
                  <Button size="icon" variant="ghost" onClick={() => removePrescription(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
          {saving ? "Saving..." : "Submit Consultation"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
