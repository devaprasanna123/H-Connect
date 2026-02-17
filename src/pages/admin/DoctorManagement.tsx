import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit, UserPlus, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DoctorManagement() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);

  // Form state
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);

  // Request state
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const fetchDoctors = async (hId: string) => {
    const { data } = await supabase
      .from("doctors")
      .select("*, profiles:user_id(full_name, phone)")
      .eq("hospital_id", hId);
    setDoctors(data || []);
  };

  const fetchAvailableDoctors = async (hId: string) => {
    // Get doctors not in this hospital
    const { data } = await supabase
      .from("doctors")
      .select("*, profiles:user_id(full_name, phone)")
      .neq("hospital_id", hId)
      .or(`hospital_id.is.null`);
    setAvailableDoctors(data || []);
  };

  const fetchPendingRequests = async (hId: string) => {
    const { data } = await supabase
      .from("doctor_requests")
      .select("*, doctors(*, profiles:user_id(full_name))")
      .eq("hospital_id", hId)
      .eq("status", "pending");
    setPendingRequests(data || []);
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doc } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      if (doc?.hospital_id) {
        setHospitalId(doc.hospital_id);
        await Promise.all([
          fetchDoctors(doc.hospital_id),
          fetchAvailableDoctors(doc.hospital_id),
          fetchPendingRequests(doc.hospital_id)
        ]);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleEditSpecialty = async () => {
    if (!editingDoctor) return;
    setSaving(true);
    await supabase.from("doctors").update({ specialty }).eq("id", editingDoctor.id);
    toast.success("Doctor updated!");
    if (hospitalId) await fetchDoctors(hospitalId);
    setDialogOpen(false);
    setEditingDoctor(null);
    setSaving(false);
  };

  const handleDelete = async (doctorId: string) => {
    if (!confirm("Remove this doctor from the hospital?")) return;
    await supabase.from("doctors").update({ hospital_id: null }).eq("id", doctorId);
    toast.success("Doctor removed from hospital.");
    if (hospitalId) {
      await fetchDoctors(hospitalId);
      await fetchAvailableDoctors(hospitalId);
    }
  };

  const handleSendRequest = async () => {
    if (!selectedDoctorId || !hospitalId) return;
    setSaving(true);

    const { error } = await supabase.from("doctor_requests").insert({
      hospital_id: hospitalId,
      doctor_id: selectedDoctorId,
      status: "pending"
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Request already sent to this doctor");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Request sent to doctor!");
      setRequestDialogOpen(false);
      setSelectedDoctorId("");
      await fetchPendingRequests(hospitalId);
    }
    setSaving(false);
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm("Cancel this request?")) return;
    await supabase.from("doctor_requests").delete().eq("id", requestId);
    toast.success("Request cancelled");
    if (hospitalId) await fetchPendingRequests(hospitalId);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  if (!hospitalId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Doctor Management</h1>
          <p className="text-muted-foreground">You are not assigned to a hospital. Please set up your hospital first.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Doctor Management</h1>
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-2 h-4 w-4" />Send Request to Doctor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Send Request to Doctor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Doctor</Label>
                  <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                    <SelectTrigger><SelectValue placeholder="Choose a doctor" /></SelectTrigger>
                    <SelectContent>
                      {availableDoctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.profiles?.full_name || "Doctor"} - {d.specialty || "General"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSendRequest} disabled={saving || !selectedDoctorId} className="w-full">
                  {saving ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList>
            <TabsTrigger value="current">Current Doctors</TabsTrigger>
            <TabsTrigger value="pending">Pending Requests ({pendingRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="mt-6">
            {doctors.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No doctors assigned to this hospital yet.</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctors.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{d.profiles?.full_name || "Doctor"}</p>
                          <p className="text-sm text-muted-foreground">{d.specialty || "General"}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => {
                            setEditingDoctor(d);
                            setSpecialty(d.specialty || "");
                            setDialogOpen(true);
                          }}><Edit className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-6">
            {pendingRequests.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No pending requests.</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingRequests.map((req) => (
                  <Card key={req.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{req.doctors?.profiles?.full_name || "Doctor"}</p>
                            <p className="text-sm text-muted-foreground">{req.doctors?.specialty || "General"}</p>
                            <p className="text-xs text-muted-foreground mt-1">Pending</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleCancelRequest(req.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Doctor</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g., Cardiology" />
              </div>
              <Button onClick={handleEditSpecialty} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Update"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
