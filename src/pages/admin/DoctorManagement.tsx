import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit } from "lucide-react";

export default function DoctorManagement() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);

  // Form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDoctors = async (hId: string) => {
    const { data } = await supabase
      .from("doctors")
      .select("*, profiles:user_id(full_name, phone)")
      .eq("hospital_id", hId);
    setDoctors(data || []);
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doc } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      if (doc?.hospital_id) {
        setHospitalId(doc.hospital_id);
        await fetchDoctors(doc.hospital_id);
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
    if (hospitalId) await fetchDoctors(hospitalId);
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
        </div>

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
