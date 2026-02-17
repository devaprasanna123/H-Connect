import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Calendar, Stethoscope, Building2, Shield, ArrowRight } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">H Connect</span>
          </div>
          <Link to="/auth">
            <Button>Get Started <ArrowRight className="ml-1 h-4 w-4" /></Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Healthcare Management,{" "}
          <span className="text-primary">Simplified</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          A multi-hospital platform connecting patients, doctors, and administrators in one seamless experience.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth"><Button size="lg">Sign Up Free</Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign In</Button></Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-2 border-primary/10">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Patient Portal</h3>
              <p className="text-sm text-muted-foreground">
                Book appointments, view medical history, and manage prescriptions with ease.
              </p>
            </CardContent>
          </Card>
          <Card className="border-2 border-accent/20">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
                <Stethoscope className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Doctor Portal</h3>
              <p className="text-sm text-muted-foreground">
                Manage consultations, write prescriptions, and track patient records efficiently.
              </p>
            </CardContent>
          </Card>
          <Card className="border-2 border-info/20">
            <CardContent className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                <Building2 className="h-6 w-6 text-info" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Admin Portal</h3>
              <p className="text-sm text-muted-foreground">
                Manage doctors, appointments, and billing across your hospital network.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-6">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 text-sm text-muted-foreground">
          <Heart className="h-4 w-4 text-primary" />
          <span>H Connect — Multi-Hospital Healthcare Platform</span>
        </div>
      </footer>
    </div>
  );
}
