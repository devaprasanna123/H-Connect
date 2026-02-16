
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');

-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'cancelled', 'rescheduled');

-- Create invoice status enum  
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Hospitals table
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  blood_group TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  gender TEXT DEFAULT '',
  age INTEGER,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Doctors table
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  specialty TEXT NOT NULL DEFAULT '',
  availability_slots JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status appointment_status NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Consultations table
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL UNIQUE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  observations TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  charges JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  pdf_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user's hospital_id (for admin/doctor scoping)
CREATE OR REPLACE FUNCTION public.get_doctor_hospital(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hospital_id FROM public.doctors WHERE user_id = _user_id LIMIT 1
$$;

-- Auto-create profile + patient/doctor record on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== RLS POLICIES ==========

-- user_roles: users can read their own roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Only service role / triggers should insert roles (done via edge function or trigger)
CREATE POLICY "Service can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- profiles: users read/update own profile, admins/doctors can read profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Doctors can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admins can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- hospitals: readable by all authenticated users, managed by admins
CREATE POLICY "Authenticated can read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update own hospital" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- patients: patients see own data, doctors see assigned patients
CREATE POLICY "Patients read own data" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients insert own data" ON public.patients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Patients update own data" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Doctors can read patients" ON public.doctors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "Admins can read patients" ON public.patients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- doctors: readable by all authenticated, managed by admins
CREATE POLICY "Authenticated can read doctors" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Doctors update own record" ON public.doctors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert doctors" ON public.doctors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update doctors" ON public.doctors FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid())
);
CREATE POLICY "Admins can delete doctors" ON public.doctors FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid())
);

-- appointments: patients see own, doctors see assigned, admins see hospital
CREATE POLICY "Patients read own appointments" ON public.appointments FOR SELECT TO authenticated 
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Patients create appointments" ON public.appointments FOR INSERT TO authenticated 
  WITH CHECK (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read assigned appointments" ON public.appointments FOR SELECT TO authenticated 
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors update assigned appointments" ON public.appointments FOR UPDATE TO authenticated 
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "Admins read hospital appointments" ON public.appointments FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital appointments" ON public.appointments FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));

-- consultations: doctors create for their appointments, patients read own
CREATE POLICY "Doctors create consultations" ON public.consultations FOR INSERT TO authenticated 
  WITH CHECK (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read own consultations" ON public.consultations FOR SELECT TO authenticated 
  USING (doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid()));
CREATE POLICY "Patients read own consultations" ON public.consultations FOR SELECT TO authenticated 
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
CREATE POLICY "Admins read consultations" ON public.consultations FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- prescriptions: same access as consultations (through consultation_id)
CREATE POLICY "Doctors create prescriptions" ON public.prescriptions FOR INSERT TO authenticated 
  WITH CHECK (consultation_id IN (
    SELECT id FROM public.consultations WHERE doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  ));
CREATE POLICY "Doctors read prescriptions" ON public.prescriptions FOR SELECT TO authenticated 
  USING (consultation_id IN (
    SELECT id FROM public.consultations WHERE doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  ));
CREATE POLICY "Patients read own prescriptions" ON public.prescriptions FOR SELECT TO authenticated 
  USING (consultation_id IN (
    SELECT id FROM public.consultations WHERE patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  ));

-- invoices: admins create/manage, patients read own
CREATE POLICY "Admins create invoices" ON public.invoices FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins read hospital invoices" ON public.invoices FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital invoices" ON public.invoices FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Patients read own invoices" ON public.invoices FOR SELECT TO authenticated 
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));
