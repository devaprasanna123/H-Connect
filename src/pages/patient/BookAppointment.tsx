import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle } from "lucide-react";

export default function BookAppointment() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    supabase.from("hospitals").select("*").then(({ data }) => setHospitals(data || []));
  }, []);

  useEffect(() => {
    if (selectedHospital) {
      supabase
        .from("doctors")
        .select("*, profiles:user_id(full_name)")
        .eq("hospital_id", selectedHospital)
        .then(({ data }) => setDoctors(data || []));
    }
  }, [selectedHospital]);

  const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

  const handleBook = async () => {
    if (!user || !selectedDate) return;
    setLoading(true);

    const { data: patient } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
    if (!patient) { toast.error("Patient record not found"); setLoading(false); return; }

    const { error } = await supabase.from("appointments").insert({
      patient_id: patient.id,
      doctor_id: selectedDoctor,
      hospital_id: selectedHospital,
      appointment_date: format(selectedDate, "yyyy-MM-dd"),
      appointment_time: selectedTime,
    });

    if (error) {
      toast.error("Booking failed: " + error.message);
    } else {
      setBooked(true);
      toast.success("Appointment booked!");
    }
    setLoading(false);
  };

  if (booked) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="mb-4 h-16 w-16 text-success" />
          <h2 className="mb-2 text-2xl font-bold">Appointment Booked!</h2>
          <p className="text-muted-foreground">Your appointment is pending approval.</p>
          <Button className="mt-6" onClick={() => { setBooked(false); setStep(1); setSelectedHospital(""); setSelectedDoctor(""); setSelectedDate(undefined); setSelectedTime(""); }}>
            Book Another
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Book Appointment</h1>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Select Hospital</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {hospitals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hospitals available.</p>
              ) : (
                <div className="space-y-2">
                  <Label>Hospital</Label>
                  <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                    <SelectTrigger><SelectValue placeholder="Choose a hospital" /></SelectTrigger>
                    <SelectContent>
                      {hospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name} — {h.city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button disabled={!selectedHospital} onClick={() => setStep(2)} className="w-full">Next</Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader><CardTitle>Select Doctor</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {doctors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No doctors at this hospital.</p>
              ) : (
                <div className="space-y-2">
                  <Label>Doctor</Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger><SelectValue placeholder="Choose a doctor" /></SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {(d as any).profiles?.full_name || "Doctor"} — {d.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
                <Button disabled={!selectedDoctor} onClick={() => setStep(3)} className="flex-1">Next</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader><CardTitle>Select Date & Time</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} disabled={(date) => date < new Date()} className="mx-auto" />
              {selectedDate && (
                <div className="space-y-2">
                  <Label>Available Time Slots</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((t) => (
                      <Button key={t} variant={selectedTime === t ? "default" : "outline"} size="sm" onClick={() => setSelectedTime(t)}>
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
                <Button disabled={!selectedDate || !selectedTime} onClick={() => setStep(4)} className="flex-1">Next</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader><CardTitle>Confirm Booking</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <p><span className="font-medium">Hospital:</span> {hospitals.find((h) => h.id === selectedHospital)?.name}</p>
                <p><span className="font-medium">Doctor:</span> {(doctors.find((d) => d.id === selectedDoctor) as any)?.profiles?.full_name}</p>
                <p><span className="font-medium">Date:</span> {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : ""}</p>
                <p><span className="font-medium">Time:</span> {selectedTime}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                <Button onClick={handleBook} disabled={loading} className="flex-1">
                  {loading ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
