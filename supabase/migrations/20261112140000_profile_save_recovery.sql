-- Ensure profile saves can recover missing profile rows and avatar storage remains
-- scoped to the authenticated user's own folder.
GRANT UPDATE (full_name, username, phone, country, avatar_url, onboarding_completed)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
CREATE POLICY profiles_owner_update
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.ensure_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _full_name text := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), '');
  _username text := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'username'), '');
  _phone text := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'phone'), '');
  _country text := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'country'), '');
  _referral_code text := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'referral_code'), '');
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, username, phone, country, referral_code
    )
    VALUES (
      NEW.id, NEW.email, _full_name, _username, _phone, _country, _referral_code
    )
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(profiles.email, EXCLUDED.email),
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      username = COALESCE(profiles.username, EXCLUDED.username),
      phone = COALESCE(profiles.phone, EXCLUDED.phone),
      country = COALESCE(profiles.country, EXCLUDED.country),
      referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);
  EXCEPTION WHEN unique_violation THEN
    -- A duplicate signup username should not prevent account creation.
    INSERT INTO public.profiles (id, email, full_name, phone, country, referral_code)
    VALUES (NEW.id, NEW.email, _full_name, _phone, _country, _referral_code)
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(profiles.email, EXCLUDED.email),
      full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
      phone = COALESCE(profiles.phone, EXCLUDED.phone),
      country = COALESCE(profiles.country, EXCLUDED.country),
      referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_create_default_row ON auth.users;
CREATE TRIGGER profiles_create_default_row
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_profile_for_auth_user();

-- Repair existing auth accounts whose profile row was never created.
INSERT INTO public.profiles (id, email, full_name, phone, country, referral_code)
SELECT
  id,
  email,
  NULLIF(BTRIM(raw_user_meta_data ->> 'full_name'), ''),
  NULLIF(BTRIM(raw_user_meta_data ->> 'phone'), ''),
  NULLIF(BTRIM(raw_user_meta_data ->> 'country'), ''),
  NULLIF(BTRIM(raw_user_meta_data ->> 'referral_code'), '')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(profiles.email, EXCLUDED.email),
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
  phone = COALESCE(profiles.phone, EXCLUDED.phone),
  country = COALESCE(profiles.country, EXCLUDED.country),
  referral_code = COALESCE(profiles.referral_code, EXCLUDED.referral_code);

-- Backfill usernames only when they do not conflict with an existing username.
WITH candidates AS (
  SELECT
    id,
    NULLIF(BTRIM(raw_user_meta_data ->> 'username'), '') AS username,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(NULLIF(BTRIM(raw_user_meta_data ->> 'username'), ''))
      ORDER BY id
    ) AS duplicate_rank
  FROM auth.users
  WHERE NULLIF(BTRIM(raw_user_meta_data ->> 'username'), '') IS NOT NULL
)
UPDATE public.profiles AS profile
SET username = candidate.username
FROM candidates AS candidate
WHERE profile.id = candidate.id
  AND profile.username IS NULL
  AND candidate.duplicate_rank = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS existing
    WHERE existing.id <> profile.id
      AND LOWER(existing.username) = LOWER(candidate.username)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_owner_insert ON storage.objects;
CREATE POLICY avatars_owner_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_owner_update ON storage.objects;
CREATE POLICY avatars_owner_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_owner_delete ON storage.objects;
CREATE POLICY avatars_owner_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
