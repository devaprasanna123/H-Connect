-- Create doctor_requests table for hospital-doctor invitations
CREATE TABLE IF NOT EXISTS public.doctor_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(hospital_id, doctor_id)
);

-- Enable RLS
ALTER TABLE public.doctor_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for doctor_requests
-- Doctors can read their own requests
CREATE POLICY "Doctors can read own requests" ON public.doctor_requests 
  FOR SELECT TO authenticated 
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));

-- Doctors can update their own requests (to accept/decline)
CREATE POLICY "Doctors can update own requests" ON public.doctor_requests 
  FOR UPDATE TO authenticated 
  USING (doctor_id IN (SELECT id FROM doctors WHERE user_id = auth.uid()));

-- Admins can read requests for their hospital
CREATE POLICY "Admins can read hospital requests" ON public.doctor_requests 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') 
    AND hospital_id = public.get_doctor_hospital(auth.uid())
  );

-- Admins can create requests for their hospital
CREATE POLICY "Admins can create hospital requests" ON public.doctor_requests 
  FOR INSERT TO authenticated 
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    AND hospital_id = public.get_doctor_hospital(auth.uid())
  );

-- Admins can delete their hospital's requests
CREATE POLICY "Admins can delete hospital requests" ON public.doctor_requests 
  FOR DELETE TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') 
    AND hospital_id = public.get_doctor_hospital(auth.uid())
  );

-- Create index for faster queries
CREATE INDEX idx_doctor_requests_doctor_id ON public.doctor_requests(doctor_id);
CREATE INDEX idx_doctor_requests_hospital_id ON public.doctor_requests(hospital_id);
CREATE INDEX idx_doctor_requests_status ON public.doctor_requests(status);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_doctor_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER doctor_requests_updated_at
  BEFORE UPDATE ON public.doctor_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_requests_updated_at();
