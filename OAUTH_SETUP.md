# 🔐 Nastavení OAuth (Google & Strava)

Problém: Po vytvoření nového Supabase projektu potřebuješ znovu nastavit OAuth integrace.

## 🔴 Co je potřeba:

### 1. Nastavit Secrets v Supabase

OAuth credentials musí být nastavené jako secrets v Supabase:

```bash
# Google OAuth
supabase secrets set GOOGLE_CLIENT_ID=tvuj-google-client-id
supabase secrets set GOOGLE_CLIENT_SECRET=tvuj-google-client-secret

# Strava OAuth
supabase secrets set STRAVA_CLIENT_ID=tvuj-strava-client-id
supabase secrets set STRAVA_CLIENT_SECRET=tvuj-strava-client-secret
```

### 2. Nastavit Redirect URI v OAuth aplikacích

#### Google OAuth (Google Cloud Console):

1. Jdi na: https://console.cloud.google.com/apis/credentials
2. Najdi svoji OAuth aplikaci
3. Přidej **Authorized redirect URIs**:
   - `http://localhost:3000/auth/callback` (pro lokální vývoj)
   - `https://rtuczjobfpqmptfofgkt.supabase.co/auth/v1/callback` (pro Supabase Auth)
   - Tvoje produkční URL (pokud máš)

#### Strava API:

1. Jdi na: https://www.strava.com/settings/api
2. Najdi svoji aplikaci
3. Nastav **Authorization Callback Domain**:
   - `localhost` (pro lokální vývoj)
   - `rtuczjobfpqmptfofgkt.supabase.co` (pro produkci)
   - Nebo tvoje doména

### 3. Nastavit Redirect URI v Supabase Auth

V Supabase Dashboard:
1. Jdi do **Authentication** → **URL Configuration**
2. Přidej do **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/strava-callback`
   - Tvoje produkční URL (pokud máš)

## 📝 Kde najít credentials:

### Google OAuth:
- **Client ID**: Google Cloud Console → APIs & Services → Credentials
- **Client Secret**: Stejné místo (možná bude potřeba vytvořit nový, pokud jsi ho ztratil)

### Strava:
- **Client ID**: Strava → Settings → My API Application
- **Client Secret**: Stejné místo (Show Client Secret)

## ⚠️ DŮLEŽITÉ:

- Redirect URI musí přesně odpovídat (včetně protokolu http/https)
- Pro lokální vývoj: `http://localhost:3000/auth/callback`
- Pro Supabase: `https://rtuczjobfpqmptfofgkt.supabase.co/auth/v1/callback`
- Secrets musí být nastavené v Supabase (ne jen v .env)

## 🔍 Jak zkontrolovat, co chybí:

1. Zkus připojit Google/Strava
2. Podívej se do konzole prohlížeče (F12) - jaká chyba se zobrazí?
3. Zkontroluj Supabase Dashboard → Edge Functions → Logs - jsou tam chyby?
