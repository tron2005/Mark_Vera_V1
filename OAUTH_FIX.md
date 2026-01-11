# 🔧 Oprava OAuth připojení

## 🔴 Problém:

Po vytvoření nového Supabase projektu chybí OAuth secrets pro Edge Functions.

## ✅ Co potřebujeme:

### 1. Google OAuth Secrets

Edge Function `google-auth-callback` potřebuje:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Co máš v .env:**
- `VITE_GOOGLE_CLIENT_ID="788663448348-vkgsjedmkrv3q1s3poblbl3v28crroqa.apps.googleusercontent.com"` ✅

**Co chybí:**
- `GOOGLE_CLIENT_SECRET` - musíš ho získat z Google Cloud Console

### 2. Strava OAuth Secrets

Edge Function `strava-auth-callback` potřebuje:
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`

**Co máš v .env:**
- `VITE_STRAVA_CLIENT_ID="185276"` ✅

**Co chybí:**
- `STRAVA_CLIENT_SECRET` - musíš ho získat z Strava API settings

## 📝 Jak to opravit:

### Krok 1: Získat Client Secrets

**Google:**
1. Jdi na: https://console.cloud.google.com/apis/credentials
2. Najdi OAuth aplikaci s Client ID: `788663448348-vkgsjedmkrv3q1s3poblbl3v28crroqa`
3. Klikni na aplikaci
4. Zkopíruj **Client Secret** (možná bude potřeba "Show" tlačítko)

**Strava:**
1. Jdi na: https://www.strava.com/settings/api
2. Najdi aplikaci s Client ID: `185276`
3. Zkopíruj **Client Secret** (klikni "Show Client Secret")

### Krok 2: Nastavit Secrets v Supabase

Až budeš mít secrets, spusť:

```bash
# Google
supabase secrets set GOOGLE_CLIENT_ID=788663448348-vkgsjedmkrv3q1s3poblbl3v28crroqa.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=tvuj-google-client-secret

# Strava
supabase secrets set STRAVA_CLIENT_ID=185276
supabase secrets set STRAVA_CLIENT_SECRET=tvuj-strava-client-secret
```

### Krok 3: Zkontrolovat Redirect URI

**Google OAuth:**
- V Google Cloud Console → Authorized redirect URIs
- Musí tam být: `http://localhost:3000/auth/callback`

**Strava:**
- V Strava API Settings → Authorization Callback Domain
- Musí tam být: `localhost` (nebo tvoje doména)

## ⚠️ Poznámka:

- `VITE_GOOGLE_CLIENT_ID` a `VITE_STRAVA_CLIENT_ID` jsou pro frontend (máš je ✅)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` jsou pro Edge Functions (chybí ❌)
