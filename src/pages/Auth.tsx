import React, { useState, useEffect } from "react";

import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export default function Auth() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect
  if (user && role) {
    const dashboardMap: Record<AppRole, string> = {
      patient: "/patient",
      doctor: "/doctor",
      admin: "/admin",
    };
    return <Navigate to={dashboardMap[role]} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Heart className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">H Connect</h1>
          <p className="mt-1 text-sm text-muted-foreground">Multi-Hospital Healthcare Platform</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login"><LoginForm /></TabsContent>
          <TabsContent value="signup"><SignupForm /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      // Role-based redirect will happen via AuthProvider
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", (await supabase.auth.getUser()).data.user!.id).maybeSingle();
      if (roleData) {
        const map: Record<string, string> = { patient: "/patient", doctor: "/doctor", admin: "/admin" };
        navigate(map[roleData.role] || "/");
      }
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

function SignupForm() {
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("patient");
  const [loading, setLoading] = useState(false);

  // Doctor specific fields
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [specialty, setSpecialty] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchHospitals = async () => {
      const { data, error } = await supabase.from("hospitals").select("id, name");
      if (error) {
        console.error("Error fetching hospitals:", error);
      }
      if (data) {
        setHospitals(data);
      }
    };
    fetchHospitals();
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (selectedRole === "doctor" && !selectedHospital) {
      toast.error("Please select a hospital");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: { full_name: fullName, role: selectedRole },
        shouldCreateUser: true,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("OTP sent to your email!");
      setStep("otp");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Explicitly handle doctor data
      if (selectedRole === "doctor") {
        const { error: docError } = await supabase.from("doctors").insert({
          user_id: data.session.user.id,
          hospital_id: selectedHospital,
          specialty: specialty || "General"
        });

        if (docError) {
          console.error("Error creating doctor profile:", docError);
          // Try upsert if insert failed (e.g. if trigger already created it)
          await supabase.from("doctors").upsert({
            user_id: data.session.user.id,
            hospital_id: selectedHospital,
            specialty: specialty || "General"
          }, { onConflict: 'user_id' });
        }
      }

      toast.success("Account verified! Redirecting...");
      const map: Record<string, string> = { patient: "/patient", doctor: "/doctor", admin: "/admin" };
      navigate(map[selectedRole] || "/");
    }
    setLoading(false);
  };

  if (step === "otp") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enter OTP</CardTitle>
          <CardDescription>We sent a code to {email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length < 6}>
              {loading ? "Verifying..." : "Verify OTP"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("details")} disabled={loading}>
              Back to details
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Join H Connect today</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Full Name</Label>
            <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Dr. Jane Smith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
          </div>
          {/* Password field removed */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="admin">Hospital Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedRole === "doctor" && (
            <>
              <div className="space-y-2">
                <Label>Hospital</Label>
                <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                  <SelectTrigger><SelectValue placeholder="Select Hospital" /></SelectTrigger>
                  <SelectContent>
                    {hospitals.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Cardiology" />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
