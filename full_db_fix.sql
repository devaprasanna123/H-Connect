-- ==========================================
-- CONSOLIDATED DATABASE FIX SCRIPT
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Link hospitals to admin users (Fixes "You are not assigned to a hospital")
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hospitals_user_id ON public.hospitals(user_id);

-- Update RLS for Admin Hospital Management
DROP POLICY IF EXISTS "Admins can update own hospital" ON public.hospitals;
CREATE POLICY "Admins can update own hospital" ON public.hospitals 
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read own hospital" ON public.hospitals;
CREATE POLICY "Admins can read own hospital" ON public.hospitals 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

-- 2. Allow Doctors to Sign Up (Fixes signup errors)
CREATE POLICY "Doctors can insert own record" ON public.doctors 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Fix Public Access (Fixes empty dropdowns)
DROP POLICY IF EXISTS "Authenticated can read hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Public can read hospitals" ON public.hospitals;
CREATE POLICY "Public can read hospitals" ON public.hospitals FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read doctors" ON public.doctors;
DROP POLICY IF EXISTS "Public can read doctors" ON public.doctors;
CREATE POLICY "Public can read doctors" ON public.doctors FOR SELECT TO anon, authenticated USING (true);

-- 4. Cleanup (Optional)
DROP TABLE IF EXISTS doctor_requests CASCADE;
