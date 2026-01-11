# 🔧 Řešení OAuth Secrets

## Problém:

Client Secrets byly uložené v původním Supabase projektu (který spravoval Lovable), ale v novém projektu je nemáme.

## Možnosti řešení:

### Možnost 1: Získat přístup k původnímu projektu (pokud je stále dostupný)

Pokud máš ještě přístup k původnímu Supabase projektu (`vemphblrcpntjnbhcxzz`):
1. Jdi do Supabase Dashboard
2. Najdi původní projekt
3. Jdi do **Settings** → **API** → **Edge Functions** → **Secrets**
4. Zkopíruj secrets:
   - `GOOGLE_CLIENT_SECRET`
   - `STRAVA_CLIENT_SECRET`

### Možnost 2: Vytvořit nové OAuth aplikace

Pokud nemáš přístup k původnímu projektu, můžeš:

**Google:**
- Použít existující Client ID: `788663448348-vkgsjedmkrv3q1s3poblbl3v28crroqa`
- V Google Cloud Console můžeš:
  - Vytvořit nový Client Secret (pokud je ten starý ztracený)
  - Nebo vytvořit úplně novou OAuth aplikaci

**Strava:**
- Použít existující Client ID: `185276`
- V Strava API Settings můžeš zobrazit Client Secret (pokud máš přístup k aplikaci)

### Možnost 3: Zkontrolovat, jestli nemáš přístup k Lovable dashboardu

Pokud máš ještě přístup k Lovable projektu, možná tam jsou secrets vidět.

## ✅ Co můžeme udělat teď:

1. **Zkus získat secrets z Google/Strava:**
   - Google: https://console.cloud.google.com/apis/credentials
   - Strava: https://www.strava.com/settings/api

2. **Nebo vytvořit nové OAuth aplikace:**
   - To bude vyžadovat aktualizaci Client ID v .env

## 📝 Co potřebujeme:

- `GOOGLE_CLIENT_SECRET` - z Google Cloud Console
- `STRAVA_CLIENT_SECRET` - z Strava API Settings

Potřebuješ pomoc s vytvořením nových OAuth aplikací, nebo máš šanci získat secrets z původního projektu?
