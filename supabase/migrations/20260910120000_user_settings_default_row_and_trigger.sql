-- Ensure every new authenticated user has a default user_settings row.
-- This is safe because the table already has a unique index on user_id.

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (
    user_id,
    theme,
    timezone,
    language,
    date_format,
    default_currency,
    default_risk_profile,
    active_connection_id,
    notifications
  )
  VALUES (
    NEW.id,
    'system',
    'UTC',
    'en',
    'YYYY-MM-DD',
    'USD',
    'BALANCED',
    NULL,
    '{}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_settings_create_default_row ON auth.users;
CREATE TRIGGER user_settings_create_default_row
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_settings();

GRANT EXECUTE ON FUNCTION public.handle_new_user_settings() TO authenticated, service_role;
