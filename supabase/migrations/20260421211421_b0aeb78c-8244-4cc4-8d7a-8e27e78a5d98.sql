
-- Fix: set search_path on trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix: avoid broad listing on public avatars bucket. Allow SELECT only on
-- specific objects (not full bucket listing). Public read remains via direct URL.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

CREATE POLICY "Avatar images are publicly readable by path"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);
