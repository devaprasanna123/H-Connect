import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Receipt } from "lucide-react";
import { format } from "date-fns";

interface ChargeItem {
  description: string;
  amount: number;
}

export default function BillingPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New invoice form
  const [selectedAppointment, setSelectedAppointment] = useState("");
  const [charges, setCharges] = useState<ChargeItem[]>([{ description: "", amount: 0 }]);
  const [saving, setSaving] = useState(false);

  const fetchData = async (hId: string) => {
    const [invRes, apptRes] = await Promise.all([
      supabase.from("invoices").select("*, patients(profiles:user_id(full_name)), appointments(appointment_date)").eq("hospital_id", hId).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*, patients(profiles:user_id(full_name))").eq("hospital_id", hId).eq("status", "completed"),
    ]);
    setInvoices(invRes.data || []);
    setAppointments(apptRes.data || []);
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: doc } = await supabase.from("doctors").select("hospital_id").eq("user_id", user.id).maybeSingle();
      if (doc?.hospital_id) {
        setHospitalId(doc.hospital_id);
        await fetchData(doc.hospital_id);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const total = charges.reduce((sum, c) => sum + (c.amount || 0), 0);

  const addCharge = () => setCharges([...charges, { description: "", amount: 0 }]);
  const removeCharge = (i: number) => setCharges(charges.filter((_, idx) => idx !== i));
  const updateCharge = (i: number, field: keyof ChargeItem, value: string | number) => {
    const updated = [...charges];
    (updated[i] as any)[field] = field === "amount" ? Number(value) : value;
    setCharges(updated);
  };

  const handleCreate = async () => {
    if (!hospitalId || !selectedAppointment) return;
    setSaving(true);

    const appt = appointments.find((a) => a.id === selectedAppointment);
    if (!appt) { setSaving(false); return; }

    const { error } = await supabase.from("invoices").insert({
      appointment_id: selectedAppointment,
      hospital_id: hospitalId,
      patient_id: appt.patient_id,
      charges: charges as any,
      total,
      status: "draft",
    });

    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Invoice created!");
      setDialogOpen(false);
      setCharges([{ description: "", amount: 0 }]);
      setSelectedAppointment("");
      await fetchData(hospitalId);
    }
    setSaving(false);
  };

  const markAsSent = async (id: string) => {
    await supabase.from("invoices").update({ status: "sent" as any }).eq("id", id);
    toast.success("Invoice marked as sent");
    if (hospitalId) await fetchData(hospitalId);
  };

  const markAsPaid = async (id: string) => {
    await supabase.from("invoices").update({ status: "paid" as any }).eq("id", id);
    toast.success("Invoice marked as paid");
    if (hospitalId) await fetchData(hospitalId);
  };

  const statusColor: Record<string, string> = {
    draft: "bg-secondary text-secondary-foreground",
    sent: "bg-info/15 text-info",
    paid: "bg-success/15 text-success",
    overdue: "bg-destructive/15 text-destructive",
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Billing & Invoicing</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Appointment</Label>
                  <Select value={selectedAppointment} onValueChange={setSelectedAppointment}>
                    <SelectTrigger><SelectValue placeholder="Select completed appointment" /></SelectTrigger>
                    <SelectContent>
                      {appointments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {(a as any).patients?.profiles?.full_name} — {format(new Date(a.appointment_date), "MMM dd")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Charges</Label>
                  {charges.map((c, i) => (
                    <div key={i} className="flex items-end gap-2">
                      <div className="flex-1 space-y-1">
                        <Input value={c.description} onChange={(e) => updateCharge(i, "description", e.target.value)} placeholder="Description" />
                      </div>
                      <div className="w-24 space-y-1">
                        <Input type="number" value={c.amount || ""} onChange={(e) => updateCharge(i, "amount", e.target.value)} placeholder="0.00" />
                      </div>
                      {charges.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeCharge(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={addCharge}><Plus className="mr-1 h-3 w-3" />Add Charge</Button>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-secondary p-3">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold">${total.toFixed(2)}</span>
                </div>

                <Button onClick={handleCreate} disabled={saving || !selectedAppointment} className="w-full">
                  {saving ? "Creating..." : "Create Invoice"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {invoices.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No invoices yet.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{(inv as any).patients?.profiles?.full_name || "Patient"}</p>
                    <p className="text-sm text-muted-foreground">
                      {inv.appointments?.appointment_date ? format(new Date(inv.appointments.appointment_date), "MMM dd, yyyy") : ""} — ${Number(inv.total).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusColor[inv.status] || ""}>{inv.status}</Badge>
                    {inv.status === "draft" && <Button size="sm" variant="outline" onClick={() => markAsSent(inv.id)}>Send</Button>}
                    {inv.status === "sent" && <Button size="sm" onClick={() => markAsPaid(inv.id)}>Mark Paid</Button>}
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
