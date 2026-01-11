# 🚀 Nastavení Supabase projektu

Tento návod ti pomůže vytvořit nový Supabase projekt a aplikovat všechny migrace.

## Krok 1: Vytvoření Supabase projektu

1. **Jdi na [supabase.com](https://supabase.com)** a přihlas se (nebo vytvoř účet)
2. **Klikni na "New Project"**
3. **Vyplň údaje:**
   - **Name**: `mark-vera` (nebo jak chceš)
   - **Database Password**: Vygeneruj silné heslo (ulož si ho!)
   - **Region**: Vyber nejbližší region (např. `West EU (Ireland)`)
   - **Pricing Plan**: Free tier je dostatečný pro začátek

4. **Počkej na vytvoření projektu** (trvá cca 2-3 minuty)

## Krok 2: Získání API klíčů

1. V Supabase Dashboard jdi do **Settings** → **API**
2. Zkopíruj si:
   - **Project URL** (např. `https://xxxxx.supabase.co`)
   - **anon/public key** (začíná `eyJhbGci...`)
   - **service_role key** (začíná `eyJhbGci...`) - ⚠️ **Tento klíč je tajný, nikdy ho nesdílej!**

## Krok 3: Nastavení Environment proměnných

Vytvoř nebo uprav soubor `.env` v kořenovém adresáři projektu:

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci... (anon key)
VITE_SUPABASE_PROJECT_ID=xxxxx

# OpenAI (pokud ještě nemáš)
OPENAI_API_KEY=sk-...

# Strava (volitelné)
VITE_STRAVA_CLIENT_ID=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...

# Google (volitelné)
VITE_GOOGLE_CLIENT_ID=...

# OpenWeatherMap (volitelné)
OPENWEATHER_API_KEY=...

# Tavily (volitelné, pro web search)
TAVILY_API_KEY=...
```

## Krok 4: Aplikace migrací

### Možnost A: Přes Supabase Dashboard (SQL Editor)

1. Jdi do **SQL Editor** v Supabase Dashboard
2. Otevři soubory z `supabase/migrations/` v pořadí podle data
3. Zkopíruj obsah každého souboru a spusť v SQL Editoru
4. **DŮLEŽITÉ**: Spouštěj migrace v chronologickém pořadí!

### Možnost B: Přes Supabase CLI (doporučeno)

1. **Nainstaluj Supabase CLI:**
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # Nebo přes npm
   npm install -g supabase
   ```

2. **Přihlas se:**
   ```bash
   supabase login
   ```

3. **Linkni projekt:**
   ```bash
   supabase link --project-ref xxxxx
   ```
   (xxxxx je tvůj Project ID z URL)

4. **Aplikuj migrace:**
   ```bash
   supabase db push
   ```

## Krok 5: Nastavení Edge Functions

1. **Nastav secrets pro Edge Functions:**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-...
   supabase secrets set STRAVA_CLIENT_ID=...
   supabase secrets set STRAVA_CLIENT_SECRET=...
   supabase secrets set OPENWEATHER_API_KEY=...
   supabase secrets set TAVILY_API_KEY=...
   ```

2. **Deployni Edge Functions:**
   ```bash
   supabase functions deploy chat
   supabase functions deploy generate-summary
   supabase functions deploy get-weather-recommendation
   supabase functions deploy get-strava-activities
   supabase functions deploy strava-auth-callback
   supabase functions deploy google-auth-callback
   supabase functions deploy create-calendar-event
   supabase functions deploy list-calendar-events
   supabase functions deploy search-gmail
   supabase functions deploy send-notes-email
   supabase functions deploy send-stats-email
   supabase functions deploy export-to-keep
   supabase functions deploy text-to-speech
   ```

   Nebo všechny najednou:
   ```bash
   supabase functions deploy
   ```

## Krok 6: Aktualizace config.toml

Uprav `supabase/config.toml` a změň `project_id` na tvůj nový Project ID:

```toml
project_id = "xxxxx"  # Tvoje nové Project ID
```

## Krok 7: Ověření

1. **Spusť aplikaci:**
   ```bash
   npm run dev
   ```

2. **Zkus se přihlásit** - měl bys být schopen vytvořit nový účet

3. **Zkontroluj, že preferences fungují** - jdi do Nastavení a zkus zapnout/vypnout BodyCombat

## 🔧 Troubleshooting

### Chyba: "Could not find the 'preferences' column"
- Ujisti se, že migrace `20250106210000_add_preferences_to_profiles.sql` byla aplikována
- Zkontroluj v SQL Editoru: `SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';`

### Chyba: "Function not found"
- Ujisti se, že Edge Functions byly deploynuté
- Zkontroluj v Supabase Dashboard → Edge Functions

### Chyba: "Invalid API key"
- Zkontroluj, že `.env` obsahuje správné klíče
- Restartuj dev server po změně `.env`

## 📝 Seznam všech migrací (v pořadí)

Migrace jsou v `supabase/migrations/` a měly by být aplikovány v tomto pořadí:

1. `20251111185338_*` - Základní tabulky (profiles, notes, conversations, messages)
2. `20251111194205_*` - Přidání sloupců do profiles
3. `20251112053854_*` - Další rozšíření
4. ... (všechny ostatní v chronologickém pořadí)
5. `20250106210000_add_preferences_to_profiles.sql` - **DŮLEŽITÉ** - preferences sloupec

## 🎯 Rychlý start (pokud máš Supabase CLI)

```bash
# 1. Login
supabase login

# 2. Link projektu
supabase link --project-ref YOUR_PROJECT_ID

# 3. Push migrací
supabase db push

# 4. Nastavit secrets
supabase secrets set OPENAI_API_KEY=sk-...

# 5. Deploy functions
supabase functions deploy

# 6. Hotovo! 🎉
```
