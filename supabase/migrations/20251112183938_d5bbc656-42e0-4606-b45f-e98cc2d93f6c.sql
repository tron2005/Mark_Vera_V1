-- Přidat sloupce pro Google Calendar OAuth tokens do profiles
ALTER TABLE public.profiles
ADD COLUMN google_access_token TEXT,
ADD COLUMN google_refresh_token TEXT,
ADD COLUMN google_token_expiry TIMESTAMPTZ;