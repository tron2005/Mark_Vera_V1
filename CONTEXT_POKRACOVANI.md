# 📋 Kontext pro pokračování v novém vlákně

## ✅ Co je hotovo:

1. **Supabase projekt vytvořen a nastaven:**
   - Project ID: `rtuczjobfpqmptfofgkt`
   - URL: `https://rtuczjobfpqmptfofgkt.supabase.co`
   - Všechny migrace aplikovány (včetně preferences sloupce)
   - Edge Functions deploynuté

2. **OAuth Secrets nastavené:**
   - ✅ Strava: Client ID `185276`, Secret nastaven v Supabase
   - ❌ Google: Potřebujeme vytvořit novou OAuth aplikaci (starý secret není dostupný)

3. **Odpojeno od Lovable:**
   - Lovable API nahrazeno OpenAI API v get-weather-recommendation a generate-summary
   - Preference sloupec přidán do TypeScript typů

## 🔴 Co zbývá:

### 1. Nastavit Google OAuth

**Problém:** Google Client Secret není dostupný (byl v Lovable projektu).

**Řešení:** Vytvořit novou OAuth aplikaci v Google Cloud Console:
1. Jdi na: https://console.cloud.google.com/apis/credentials
2. Vytvoř novou OAuth 2.0 Client ID
3. Zkopíruj Client ID a Client Secret
4. Nastav secrets:
   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=novy-client-id
   supabase secrets set GOOGLE_CLIENT_SECRET=novy-client-secret
   ```
5. Aktualizuj .env: `VITE_GOOGLE_CLIENT_ID=novy-client-id`
6. Přidej redirect URI v Google Console: `http://localhost:3000/auth/callback`

### 2. Otestovat OAuth připojení

Po nastavení Google OAuth zkus připojit Google Calendar a Strava v aplikaci.

## 📝 Důležité informace:

- **Supabase Project ID:** `rtuczjobfpqmptfofgkt`
- **Strava Client ID:** `185276` (secret je v Supabase secrets)
- **Google Client ID (starý):** `788663448348-vkgsjedmkrv3q1s3poblbl3v28crroqa` (potřebuje nový secret)
- **GitHub repo:** https://github.com/tron2005/Mark_Vera_V1

## 🎯 Co říct v novém vlákně:

"Potřebuji dokončit nastavení OAuth. Máme nový Supabase projekt (rtuczjobfpqmptfofgkt), Strava je nastavená, ale potřebujeme vytvořit novou Google OAuth aplikaci, protože starý Client Secret není dostupný. Můžeš mi pomoct vytvořit novou Google OAuth aplikaci a nastavit ji?"
