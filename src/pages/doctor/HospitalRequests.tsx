import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Building2 } from "lucide-react";

export default function HospitalRequests() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [doctorId, setDoctorId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async (dId: string) => {
        const { data } = await supabase
            .from("doctor_requests")
            .select("*, hospitals(name, city, address)")
            .eq("doctor_id", dId)
            .eq("status", "pending");
        setRequests(data || []);
    };

    useEffect(() => {
        if (!user) return;
        const fetch = async () => {
            const { data: doc } = await supabase
                .from("doctors")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (doc) {
                setDoctorId(doc.id);
                await fetchRequests(doc.id);
            }
            setLoading(false);
        };
        fetch();
    }, [user]);

    const handleAccept = async (requestId: string, hospitalId: string) => {
        if (!doctorId) return;

        // Update request status to accepted
        const { error: requestError } = await supabase
            .from("doctor_requests")
            .update({ status: "accepted" })
            .eq("id", requestId);

        if (requestError) {
            toast.error(requestError.message);
            return;
        }

        // Update doctor's hospital_id
        const { error: doctorError } = await supabase
            .from("doctors")
            .update({ hospital_id: hospitalId })
            .eq("id", doctorId);

        if (doctorError) {
            toast.error(doctorError.message);
            return;
        }

        toast.success("Request accepted! You are now part of the hospital.");
        await fetchRequests(doctorId);
    };

    const handleDecline = async (requestId: string) => {
        if (!doctorId) return;

        const { error } = await supabase
            .from("doctor_requests")
            .update({ status: "declined" })
            .eq("id", requestId);

        if (error) {
            toast.error(error.message);
            return;
        }

        toast.success("Request declined");
        await fetchRequests(doctorId);
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Hospital Requests</h1>
                    <p className="text-muted-foreground mt-1">
                        Review and manage hospital invitations
                    </p>
                </div>

                {requests.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No pending hospital requests</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {requests.map((req) => (
                            <Card key={req.id}>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-start gap-2">
                                        <Building2 className="h-5 w-5 mt-0.5 text-primary" />
                                        <span>{req.hospitals?.name || "Hospital"}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        {req.hospitals?.city && (
                                            <p>📍 {req.hospitals.city}</p>
                                        )}
                                        {req.hospitals?.address && (
                                            <p className="text-xs">{req.hospitals.address}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => handleAccept(req.id, req.hospital_id)}
                                            className="flex-1"
                                            size="sm"
                                        >
                                            <Check className="mr-1 h-4 w-4" />
                                            Accept
                                        </Button>
                                        <Button
                                            onClick={() => handleDecline(req.id)}
                                            variant="outline"
                                            className="flex-1"
                                            size="sm"
                                        >
                                            <X className="mr-1 h-4 w-4" />
                                            Decline
                                        </Button>
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
