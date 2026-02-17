-- Allow public read access to hospitals (needed for signup dropdown)
DROP POLICY IF EXISTS "Authenticated can read hospitals" ON public.hospitals;
CREATE POLICY "Public can read hospitals" ON public.hospitals FOR SELECT TO anon, authenticated USING (true);

-- Allow public read access to doctors (if needed for public directory, or just to be safe)
DROP POLICY IF EXISTS "Authenticated can read doctors" ON public.doctors;
CREATE POLICY "Public can read doctors" ON public.doctors FOR SELECT TO anon, authenticated USING (true);
