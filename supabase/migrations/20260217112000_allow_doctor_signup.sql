-- Allow doctors to insert their own record during signup
CREATE POLICY "Doctors can insert own record" ON public.doctors 
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Ensure they can read their own record (already likely covered but good to be safe)
-- Existing: "Authenticated can read doctors" (covers select)

-- Ensure doctors can update their own record (for profile updates)
-- Existing: "Doctors update own record" (covers update)
