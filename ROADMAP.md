# MarkVera Roadmap v1.1.0 🚀

Projekt se transformuje z testovací aplikace na plnohodnotného asistenta M.A.R.K. & V.E.R.A. s cílem běžet lokálně na Raspberry Pi 5.

---

## ✅ Vyřešené Problémy (Historie)

### 🔧 Opakované padání startu aplikace (vyřešeno 19.2.2026)
**Problém:** Aplikace po vypnutí nešla znovu spustit. Build (`vite build`) zamrzával na nekonečno. Opakující se problém po celý měsíc.

**Příčiny:**
1. `START_MARKVERA.command` používal `start:stable` skript, který dělal **plný production build** – ten zamrzával kvůli zaseklým `esbuild` procesům a plnému disku (99%).
2. `vite.config.ts` měl `optimizeDeps: { noDiscovery: true }` – blokoval automatickou kompilaci závislostí.
3. Disk na 99% kapacity (jen ~13 GB volných z 713 GB) – nedostatek místa pro cache a dočasné soubory.

**Řešení:**
- ✅ `START_MARKVERA.command` přepsán na robustní dev server (`npm run start`)
- ✅ `start-robust.sh` vylepšen: zabíjí zombie procesy, čistí porty, používá lokální vite binárku
- ✅ `optimizeDeps` blokáda odstraněna z `vite.config.ts`
- ✅ Přeinstalace `node_modules` (čistý `npm install`)
- ⚠️ **DOPORUČENÍ: Uvolnit místo na disku!** Vysypat Koš, smazat staré stahování.

### 🔌 Strava integrace nefunguje (vyřešeno 19.2.2026)
**Problém:** Po odpojení od Lovable přestala fungovat Strava integrace – chyby 401, 500, a "Failed to send a request to the Edge Function".

**Příčiny:**
1. Edge funkce `strava-auth-callback` a `get-strava-activities` měly `verify_jwt = true`, ale po redirect ze Stravy JWT nebyl předán správně → gateway vracelo 401.
2. Edge funkce `get-strava-activities` úplně chyběla (prázdná složka).
3. Nově vytvořená funkce používala špatné názvy sloupců (`activity_name` místo `name`, `elevation_gain` místo `total_elevation_gain`).
4. Funkce zapisovaly do DB přes anon key, ale RLS politiky blokovaly zápisy.
5. Frontend dotaz na `strava_sync_log` používal `.single()` místo `.maybeSingle()` → chyba 406.
6. `CardTitle` (h3 element) kolidoval s browser extensions (Google Translate) → crash `removeChild`.

**Řešení:**
- ✅ Obě Strava edge funkce deploynuty s `--no-verify-jwt` (auth se řeší uvnitř funkce)
- ✅ `get-strava-activities` vytvořena od nuly – stahuje aktivity za 90 dní, automaticky refreshuje tokeny
- ✅ Názvy sloupců opraveny dle skutečného DB schématu
- ✅ Obě funkce používají `SUPABASE_SERVICE_ROLE_KEY` pro DB operace (bypass RLS)
- ✅ `StravaCallback.tsx` přepsán s explicitním JWT headerem a lepším error handling
- ✅ `ErrorBoundary` vylepšen – auto-recovery pro DOM extension chyby (až 3 pokusy)
- ✅ `index.html` – `translate="no"` a `notranslate` class proti Google Translate
- ✅ Supabase secrets nastaveny: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`

---

## 🏆 Fáze 1: Stabilizace a Základy (Hotovo / Probíhá)
- [x] **Separace od Lovable**: Vlastní GitHub repozitář `mark-vera`.
- [x] **UI Refaktoring**: Rozdělení karty Trenér na "Výkon" a "Konektory".
- [x] **Oprava Logování Jídla**: Oddělení jídla od poznámek.
- [x] **Stabilní Start**: Robustní start skript s auto-cleanup (viz výše).
- [x] **Strava Integrace**: Plně funkční OAuth + synchronizace aktivit (32 aktivit ✅).
- [x] **Error Boundary**: Auto-recovery pro DOM chyby způsobené browser extensions.
- [ ] **Verzování**: Zavedení striktního verzování (package.json).

## 🎨 Fáze 2A: Design Refresh - **CURRENT FOCUS** (19.2.2026)
*Cíl: Přeměnit čistou ale jednobarevnou aplikaci na vizuálně premium produkt.*

### Barvy a vizuální identita
- [x] Barevné rozlišení typů aktivit (Run=zelená, Walk=oranžová, Strength=fialová, Ride=modrá)
- [x] Gradient hero sekce nahoře (motivační citát)
- [ ] Barevné progress bary VO2max/Maratón (zelená/oranž/červená podle úrovně)
- [x] České překlady typů aktivit v UI (Run→Běh, Walk→Chůze, WeightTraining→Posilování)

### Micro-animace a interakce
- [x] Fade-in animace karet při scrollu
- [x] Hover efekty na kartách aktivit (zvětšení, stín)
- [ ] Animované progress bary (plynulé vyplňování)
- [ ] Pulsující ikona při synchronizaci

### Layout a UX
- [x] Prázdný profil → výzva k doplnění údajů ("Doplňte svůj profil pro přesnější analýzy")
- [x] Karta "AI Trenér" – přidat ikony k odrážkám
- [ ] Lepší mobilní responzivita

### Dark Mode
- [x] Implementace dark mode (přepínač v nastavení)
- [x] Tmavé barevné schéma konzistentní s modrým brandem

## 📊 Fáze 2B: Pokročilá Analytika (Runalyze-style)
- [ ] **Advanced Metrics Widget**:
    - Výpočet TRIMP (Training Impulse).
    - ATL (Únava - 7 dní).
    - CTL (Kondice - 42 dní).
    - TSB (Stress Balance).
    - VO2max odhad z HR dat.
    - Monotónnost tréninku.
- [ ] **Automatická synchronizace**: Strava webhook / periodický sync.

## 🧠 Fáze 3: Pokročilá Inteligence (Cloud Bridge)
- [ ] **Context Awareness**: Asistent si před odpovědí přečte souhrn dat z karty Trenér.
- [ ] **Osobnosti**: Přepínač v nastavení pro volbu "Mark" (Technik) vs. "Vera" (Empatie).
- [ ] **Dlouhodobá Paměť**: Vylepšení `create_summary` pro denní přehledy.
- [ ] **Kalendář & Mail**: Plná integrace nástrojů Google Calendar a Gmail.
  - [x] Čtení událostí (dotaz "co mám zítra")
  - [x] Vytváření událostí z chatu
  - [x] Čtení Gmailu (dnes / poslední hodina)
  - [ ] Mazání událostí (podle názvu a data)
  - [ ] Přesun událostí (změna času/dne)
  - [ ] Stabilní souhrny Gmailu (kratší výstupy, bez rate-limit)
  - [ ] Vyhledání událostí podle názvu/časového okna
  - [x] **Web Search**: Vyhledávání aktuálních informací na internetu (Tavily).
  - [ ] **File Workspace**: Pracovní prostor pro soubory (PDF, CSV, obrázky) a jejich analýza.

## 🏠 Fáze 4: Lokální Mozek (MarkVera Offline)
*Cílový stav: Běh na RPi 5 bez závislosti na cloudu.*
- [ ] **Hardware**: RPi 5 + NVMe SSD + Coral TPU (volitelně).
- [ ] **Lokální LLM**: Ollama (Llama 3 / Mistral) běžící přímo na RPi.
- [ ] **Hlasový Server**: Python backend na RPi nahrazující Supabase Edge Functions.
- [ ] **Voice Client**: Mikrofon + Reproduktor ovládaný lokálně.

## 📦 Backlog vylepšení
- [ ] Vizualizace makroživin (navazuje na opravu jídla).
- [ ] 3D vizualizace svalových skupin.
- [ ] Správa vozového parku (servis, STK).
- [ ] Zálohování: stabilní tag + lokální archiv po každé funkční verzi.
- [ ] **Supabase Sleep/Resume**: jak zabránit uspání projektu a jak ho obnovit.
  - **Obnova**: Supabase Dashboard → Project → Resume (nebo otevřít projekt v dashboardu a potvrdit).
  - **Prevence**: přejít na placený plán, nebo nastavit periodický „keep‑alive" ping (cron/uptime monitor) na veřejný endpoint.
