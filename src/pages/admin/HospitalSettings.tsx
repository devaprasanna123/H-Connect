import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function HospitalSettings() {
  const { user } = useAuth();
  const [hospital, setHospital] = useState<any>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doc } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      if (doc?.hospital_id) {
        const { data: hosp } = await supabase.from("hospitals").select("*").eq("id", doc.hospital_id).maybeSingle();
        if (hosp) {
          setHospital(hosp);
          setName(hosp.name);
          setAddress(hosp.address);
          setCity(hosp.city);
          setPhone(hosp.phone || "");
          setEmail(hosp.email || "");
        }
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    if (hospital) {
      const { error } = await supabase.from("hospitals").update({ name, address, city, phone, email }).eq("id", hospital.id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }

      // Refetch hospital data to refresh the UI
      const { data: updatedHosp } = await supabase.from("hospitals").select("*").eq("id", hospital.id).maybeSingle();
      if (updatedHosp) {
        setHospital(updatedHosp);
        setName(updatedHosp.name);
        setAddress(updatedHosp.address);
        setCity(updatedHosp.city);
        setPhone(updatedHosp.phone || "");
        setEmail(updatedHosp.email || "");
      }
      toast.success("Hospital updated!");
    } else {
      // Create new hospital and assign it
      const { data: newHosp, error } = await supabase.from("hospitals").insert({ name, address, city, phone, email }).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Link user to hospital. Check if doctor record exists first.
      const { data: existingDoc } = await supabase.from("doctors").select("id").eq("user_id", user!.id).maybeSingle();

      if (existingDoc) {
        await supabase.from("doctors").update({ hospital_id: newHosp.id }).eq("user_id", user!.id);
      } else {
        await supabase.from("doctors").insert({
          user_id: user!.id,
          hospital_id: newHosp.id,
          specialty: "Hospital Admin"
        });
      }

      setHospital(newHosp);
      setName(newHosp.name);
      setAddress(newHosp.address);
      setCity(newHosp.city);
      setPhone(newHosp.phone || "");
      setEmail(newHosp.email || "");
      toast.success("Hospital created!");
    }
    setSaving(false);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">{hospital ? "Hospital Settings" : "Set Up Your Hospital"}</h1>

        <Card>
          <CardHeader><CardTitle>Hospital Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Hospital Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="City General Hospital" />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="New York" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Medical Dr" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@hospital.com" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving || !name} className="w-full">
          {saving ? "Saving..." : hospital ? "Update Hospital" : "Create Hospital"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
