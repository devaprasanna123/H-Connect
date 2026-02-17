-- ==========================================
-- COMPLETE DATABASE SETUP SCRIPT
-- Run this in your NEW Supabase Project
-- ==========================================

-- 1. Types & Enums
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor', 'admin');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- 2. Tables

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hospitals (Includes user_id fix for Admins)
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Link to Admin User
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hospitals_user_id ON public.hospitals(user_id);

-- Patients
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

-- Doctors
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  specialty TEXT NOT NULL DEFAULT '',
  availability_slots JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
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

-- Consultations
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL UNIQUE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  observations TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescriptions
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices
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

-- 3. Functions & Triggers

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check Role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Helper Function: Get Doctor's Hospital
CREATE OR REPLACE FUNCTION public.get_doctor_hospital(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hospital_id FROM public.doctors WHERE user_id = _user_id LIMIT 1
$$;

-- Trigger: Handle New User (Auto-create profile/role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role text;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role);

  IF _role = 'patient' THEN
    INSERT INTO public.patients (user_id) VALUES (NEW.id);
  ELSIF _role = 'doctor' THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update Updated_At
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. RLS Policies

-- user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'doctor'));

-- hospitals (Public Read Access for Signup!)
CREATE POLICY "Public can read hospitals" ON public.hospitals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update own hospital" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());
CREATE POLICY "Admins can read own hospital" ON public.hospitals FOR SELECT TO authenticated USING (user_id = auth.uid());

-- patients
CREATE POLICY "Patients read own data" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients update own data" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read patients" ON public.patients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- doctors
CREATE POLICY "Public can read doctors" ON public.doctors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Doctors update own record" ON public.doctors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- Allow doctors to insert own record during signup
CREATE POLICY "Doctors can insert own record" ON public.doctors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can insert doctors" ON public.doctors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update doctors" ON public.doctors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins can delete doctors" ON public.doctors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));

-- appointments
CREATE POLICY "Patients read own appointments" ON public.appointments FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Patients create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read assigned appointments" ON public.appointments FOR SELECT TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors update assigned appointments" ON public.appointments FOR UPDATE TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Admins read hospital appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));

-- consultations
CREATE POLICY "Patients read own consultations" ON public.consultations FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read own consultations" ON public.consultations FOR SELECT TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors create consultations" ON public.consultations FOR INSERT TO authenticated WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Admins read consultations" ON public.consultations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- prescriptions
CREATE POLICY "Doctors create prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (consultation_id IN (SELECT c.id FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE d.user_id = auth.uid()));
CREATE POLICY "Doctors read prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (consultation_id IN (SELECT c.id FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE d.user_id = auth.uid()));
CREATE POLICY "Patients read own prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (consultation_id IN (SELECT c.id FROM consultations c JOIN patients p ON c.patient_id = p.id WHERE p.user_id = auth.uid()));

-- invoices
CREATE POLICY "Patients read own invoices" ON public.invoices FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Admins read hospital invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
