
-- 1. Update handle_new_user to also create role and patient/doctor records from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role text;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Get role from metadata, default to 'patient'
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');

  -- Create user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role);

  -- Create role-specific record
  IF _role = 'patient' THEN
    INSERT INTO public.patients (user_id) VALUES (NEW.id);
  ELSIF _role = 'doctor' THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create the trigger (it's missing!)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix ALL RLS policies to be PERMISSIVE

-- user_roles
DROP POLICY IF EXISTS "Service can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- profiles  
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Doctors can read profiles" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Doctors can read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'doctor'));

-- patients
DROP POLICY IF EXISTS "Patients read own data" ON public.patients;
DROP POLICY IF EXISTS "Patients update own data" ON public.patients;
DROP POLICY IF EXISTS "Patients insert own data" ON public.patients;
DROP POLICY IF EXISTS "Admins can read patients" ON public.patients;
CREATE POLICY "Patients read own data" ON public.patients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Patients update own data" ON public.patients FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read patients" ON public.patients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- doctors
DROP POLICY IF EXISTS "Authenticated can read doctors" ON public.doctors;
DROP POLICY IF EXISTS "Doctors update own record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can read patients" ON public.doctors;
DROP POLICY IF EXISTS "Admins can insert doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins can update doctors" ON public.doctors;
DROP POLICY IF EXISTS "Admins can delete doctors" ON public.doctors;
CREATE POLICY "Authenticated can read doctors" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Doctors update own record" ON public.doctors FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert doctors" ON public.doctors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update doctors" ON public.doctors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins can delete doctors" ON public.doctors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));

-- hospitals
DROP POLICY IF EXISTS "Authenticated can read hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins can insert hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Admins can update own hospital" ON public.hospitals;
CREATE POLICY "Authenticated can read hospitals" ON public.hospitals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert hospitals" ON public.hospitals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update own hospital" ON public.hospitals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- appointments
DROP POLICY IF EXISTS "Patients read own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Patients create appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors read assigned appointments" ON public.appointments;
DROP POLICY IF EXISTS "Doctors update assigned appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins read hospital appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins update hospital appointments" ON public.appointments;
CREATE POLICY "Patients read own appointments" ON public.appointments FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Patients create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read assigned appointments" ON public.appointments FOR SELECT TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors update assigned appointments" ON public.appointments FOR UPDATE TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Admins read hospital appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));

-- consultations
DROP POLICY IF EXISTS "Patients read own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors read own consultations" ON public.consultations;
DROP POLICY IF EXISTS "Doctors create consultations" ON public.consultations;
DROP POLICY IF EXISTS "Admins read consultations" ON public.consultations;
CREATE POLICY "Patients read own consultations" ON public.consultations FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Doctors read own consultations" ON public.consultations FOR SELECT TO authenticated USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Doctors create consultations" ON public.consultations FOR INSERT TO authenticated WITH CHECK (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));
CREATE POLICY "Admins read consultations" ON public.consultations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- prescriptions
DROP POLICY IF EXISTS "Doctors create prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctors read prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Patients read own prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors create prescriptions" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (consultation_id IN (SELECT c.id FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE d.user_id = auth.uid()));
CREATE POLICY "Doctors read prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (consultation_id IN (SELECT c.id FROM consultations c JOIN doctors d ON c.doctor_id = d.id WHERE d.user_id = auth.uid()));
CREATE POLICY "Patients read own prescriptions" ON public.prescriptions FOR SELECT TO authenticated USING (consultation_id IN (SELECT c.id FROM consultations c JOIN patients p ON c.patient_id = p.id WHERE p.user_id = auth.uid()));

-- invoices
DROP POLICY IF EXISTS "Patients read own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins read hospital invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins create invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins update hospital invoices" ON public.invoices;
CREATE POLICY "Patients read own invoices" ON public.invoices FOR SELECT TO authenticated USING (patient_id IN (SELECT id FROM patients WHERE user_id = auth.uid()));
CREATE POLICY "Admins read hospital invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
CREATE POLICY "Admins update hospital invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND hospital_id = public.get_doctor_hospital(auth.uid()));
