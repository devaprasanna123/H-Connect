-- Add user_id column to hospitals table to link hospitals with admin users
ALTER TABLE public.hospitals 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hospitals_user_id ON public.hospitals(user_id);

-- Update RLS policy to allow admins to manage their own hospital
DROP POLICY IF EXISTS "Admins can update own hospital" ON public.hospitals;
CREATE POLICY "Admins can update own hospital" ON public.hospitals 
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') AND user_id = auth.uid());

-- Allow admins to see their own hospital
CREATE POLICY "Admins can read own hospital" ON public.hospitals 
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());
