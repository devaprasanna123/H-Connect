import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function DoctorManagement() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hospitalId, setHospitalId] = useState<string | null>(null);

  const fetchDoctors = async (hId: string) => {
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profiles:user_id(full_name, phone)")
      .eq("hospital_id", hId);

    if (error) {
      console.error("Error fetching doctors:", error);
      toast.error("Failed to load doctors");
    } else {
      console.log("Fetched doctors for hospital:", data);
      setDoctors(data || []);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Admin users look up their hospital from the hospitals table
      const { data: hospital, error: hospitalError } = await supabase
        .from("hospitals")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (hospitalError) {
        console.error("Error fetching hospital:", hospitalError);
        toast.error("Failed to load hospital information");
        setLoading(false);
        return;
      }

      if (hospital?.id) {
        console.log("Found hospital for admin:", hospital.id);
        setHospitalId(hospital.id);
        await fetchDoctors(hospital.id);
      } else {
        console.warn("No hospital found for this admin user");
        toast.error("No hospital associated with this account. Please set up your hospital first.");
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hospitalId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Doctor Management</h1>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                You are not assigned to a hospital. Please set up your hospital first.
              </p>
            </CardContent>
          </Card>
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

        <Card>
          <CardHeader>
            <CardTitle>Doctors in Your Hospital</CardTitle>
          </CardHeader>
          <CardContent>
            {doctors.length === 0 ? (
              <p className="text-muted-foreground">
                No doctors assigned to this hospital yet. Doctors can join your hospital by selecting it during signup.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {doctors.map((doctor) => (
                  <Card key={doctor.id}>
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <h3 className="font-semibold">
                          {doctor.profiles?.full_name || "Doctor"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Specialty: {doctor.specialty || "General"}
                        </p>
                        {doctor.profiles?.phone && (
                          <p className="text-sm text-muted-foreground">
                            Phone: {doctor.profiles.phone}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
