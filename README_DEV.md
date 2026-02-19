# 🛠️ Vývojářský Průvodce MarkVera

## 🚀 Spuštění aplikace

### Nejjednodušší způsob (dvojklik)
Poklepejte na soubor `START_MARKVERA.command` ve Finderu.
Aplikace se otevře v prohlížeči na **http://127.0.0.1:3500**

### Z terminálu
```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
npm run start
```

### S vyčištěním cache (pokud nefunguje normální start)
```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
CLEAN=1 npm run start
```

---

## 🔥 Nouzová oprava (když nic nefunguje)

Pokud aplikace zamrzne nebo nejde spustit, proveďte tyto kroky:

```bash
# 1. Zabít všechny zaseklé procesy
pkill -f node; pkill -f esbuild; pkill -f vite

# 2. Smazat vše a přeinstalovat
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
rm -rf node_modules dist package-lock.json

# 3. Čistá instalace
npm install

# 4. Spustit
npm run start
```

**⚠️ Důležité:** Zkontrolujte volné místo na disku! Aplikace potřebuje alespoň 5 GB volného místa.
```bash
df -h /System/Volumes/Data
```

---

## 📋 Dostupné příkazy

| Příkaz | Popis |
|--------|-------|
| `npm run start` | **Doporučený** – robustní start s auto-cleanup |
| `npm run dev` | Stejné jako `start` |
| `CLEAN=1 npm run start` | Start s vyčištěním cache |
| `npm run build` | Production build (NEPOUŽÍVAT pro lokální vývoj) |

---

## ⚙️ Konfigurace

- **Port:** `3500` (pevně nastavený)
- **Adresa:** `http://127.0.0.1:3500`
- **Config:** `vite.config.ts`
- **Env proměnné:** `.env` (podle `.env.example`)

---

## 📂 Struktura projektu

```
markvera/
├── src/                    # Zdrojový kód aplikace
├── supabase/               # Supabase konfigurace a Edge Functions
├── scripts/                # Spouštěcí skripty
│   ├── start-robust.sh     # Hlavní start skript (používá npm run start)
│   ├── start-stable.sh     # Production build (starší, nepoužívat)
│   └── dev-start.sh        # Alternativní dev start
├── START_MARKVERA.command  # Dvojklik spuštění
├── .env                    # Environment proměnné (není v gitu)
├── vite.config.ts          # Vite konfigurace
└── package.json            # Závislosti a skripty
```

---

## 🐛 Časté problémy a řešení

### Aplikace se nespustí / zamrzne na "building..."
- **Příčina:** Zaseklé esbuild/node procesy, poškozená cache, plný disk
- **Řešení:** Viz sekce "Nouzová oprava" výše

### Bílá obrazovka v prohlížeči
- **Příčina:** Vite kompiluje soubory (první start po instalaci trvá ~30s)
- **Řešení:** Počkejte 30-60 sekund, pak obnovte stránku (Cmd+R)

### Port 3500 je obsazený
- **Příčina:** Starý proces nebyl ukončen
- **Řešení:** `npm run start` automaticky uvolní port. Nebo ručně: `lsof -ti:3500 | xargs kill -9`

### Disk je plný (99%)
- **Příčina:** Nedostatek místa zpomaluje vše a způsobuje zamrzání
- **Řešení:** Vysypat Koš, smazat staré soubory ze Stahování

---

## 🔧 Technologie

- **Frontend:** React + Vite + TypeScript
- **Backend:** Supabase (produkční)
- **UI:** Shadcn/ui + Tailwind CSS
- **AI:** OpenAI API (GPT-4o)
- **Integrace:** Strava API, Google Calendar, Gmail

---

## 🏃‍♂️ Strava Integrace

### Architektura
- **OAuth flow:** `Settings.tsx` → Strava authorize → `StravaCallback.tsx` → `strava-auth-callback` edge funkce
- **Sync aktivit:** `FitnessTrainer.tsx` → `get-strava-activities` edge funkce → `strava_activities` tabulka

### Supabase Edge Functions
Obě Strava funkce jsou deploynuty s `--no-verify-jwt` (autorizace se řeší uvnitř funkce pomocí `Authorization` headeru):

```bash
# Deploy Strava edge funkcí
npx supabase functions deploy strava-auth-callback --no-verify-jwt --project-ref rtuczjobfpqmptfofgkt
npx supabase functions deploy get-strava-activities --no-verify-jwt --project-ref rtuczjobfpqmptfofgkt
```

### Supabase Secrets
```bash
npx supabase secrets set STRAVA_CLIENT_ID=185276 --project-ref rtuczjobfpqmptfofgkt
npx supabase secrets set STRAVA_CLIENT_SECRET=<secret> --project-ref rtuczjobfpqmptfofgkt
```

### Strava API nastavení
- **Authorization Callback Domain:** `127.0.0.1` (pro lokální vývoj)
- **OAuth scopes:** `read,activity:read_all,profile:read_all`

### Troubleshooting
- **401 chyba:** Funkce má `verify_jwt = true` → deployni s `--no-verify-jwt`
- **0 aktivit synchronizováno:** Zkontroluj názvy sloupců v edge funkci vs. DB schéma
- **406 chyba na sync_log:** Použij `.maybeSingle()` místo `.single()`
- **removeChild crash:** Způsobeno browser extensions → `ErrorBoundary` auto-recovery + `translate="no"` na HTML

