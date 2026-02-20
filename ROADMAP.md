# MarkVera Roadmap v1.3.0 🚀

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
- [x] **Verzování**: Zavedení striktního verzování (package.json) + CHANGELOG.md.

## 🎨 Fáze 2A: Design Refresh - ✅ HOTOVO (20.2.2026)
*Cíl: Přeměnit čistou ale jednobarevnou aplikaci na vizuálně premium produkt.*

### Barvy a vizuální identita
- [x] Barevné rozlišení typů aktivit (Run=zelená, Walk=oranžová, Strength=fialová, Ride=modrá)
- [x] Gradient hero sekce nahoře (motivační citát)
- [x] Barevné progress bary VO2max/Maratón (zelená/oranž/červená podle úrovně)
- [x] České překlady typů aktivit v UI (Run→Běh, Walk→Chůze, WeightTraining→Posilování)

### Micro-animace a interakce
- [x] Fade-in animace karet při scrollu
- [x] Hover efekty na kartách aktivit (zvětšení, stín)
- [x] Animované progress bary (plynulé vyplňování)
- [x] Pulsující ikona při synchronizaci

### Layout a UX
- [x] Prázdný profil → výzva k doplnění údajů ("Doplňte svůj profil pro přesnější analýzy")
- [x] Karta "AI Trenér" – přidat ikony k odrážkám
- [x] Lepší mobilní responzivita
- [x] Klikatelné aktivity → detail s metrikami (vzdálenost, tempo, tep, kalorie)

### Dark Mode
- [x] Implementace dark mode (přepínač v nastavení)
- [x] Tmavé barevné schéma konzistentní s modrým brandem

## 📊 Fáze 2B: Pokročilá Analytika (Runalyze-style) - ✅ HOTOVO (20.2.2026)
- [x] **Advanced Metrics Widget**:
    - Výpočet TRIMP (Training Impulse).
    - ATL (Únava - 7 dní).
    - CTL (Kondice - 42 dní).
    - TSB (Stress Balance).
    - VO2max odhad z HR dat.
    - Monotónnost tréninku + Strain.
- [x] **PMC Chart**: Performance Management Chart (ATL/CTL/TSB + TRIMP barový graf).
- [x] **Automatická synchronizace**: Denní auto-sync ze Stravy (1x za 24h + ruční).
- [x] **Opraveno**: Tlačítko "Počasí pro běh" (OPENWEATHER_API_KEY + deploy edge funkce).

## 🧠 Fáze 3: Pokročilá Inteligence (Cloud Bridge)
- [x] **Context Awareness**: Asistent si před odpovědí přečte 5 posledních aktivit, dnešní výživu a týdenní průměry makroživin.
- [ ] **Osobnosti**: Přepínač v nastavení pro volbu "Mark" (Technik) vs. "Vera" (Empatie).
- [ ] **Dlouhodobá Paměť**: Vylepšení `create_summary` pro denní přehledy.
- [ ] **Kalendář & Mail**: Plná integrace nástrojů Google Calendar a Gmail.
  - [x] Čtení událostí (dotaz "co mám zítra")
  - [x] Vytváření událostí z chatu
  - [x] Čtení Gmailu (dnes / poslední hodina)
  - [x] Mazání událostí (podle názvu a data)
  - [x] Přesun událostí (změna času/dne) - včetně českých názvů dnů
  - [x] Stabilní souhrny Gmailu (metadata-only, max 5 emailů, 100ms pauza, bez rate-limit)
  - [x] Vyhledání událostí podle názvu/časového okna (search_calendar_events, Google Calendar q param)
  - [x] **Web Search**: Vyhledávání aktuálních informací na internetu (Tavily).
  - [ ] **File Workspace**: Pracovní prostor pro soubory (PDF, CSV, obrázky) a jejich analýza.
- [x] **Závody a cíle – vylepšení**:
  - Widget zobrazuje všechny závody bez limitu (bylo max 3)
  - AI má závody automaticky v kontextu (12 měsíců dopředu) – zohledňuje je v tréninkových radách
  - Nový tool `update_race_goal` – úprava data/typu/cíle přes chat
- [x] **Hlasový výstup (TTS)**: OpenAI TTS – Mark = Onyx (mužský hlas), Vera = Nova (ženský hlas). Klik na ikonu reproduktoru přehraje odpověď, druhý klik zastaví.
- [ ] **Voice Chat (obousměrný)**: Plnohodnotný hlasový chat bez psaní.
  - Jedno tlačítko pro zachycení hlasu → STT (Whisper) → AI odpověď → TTS přehrání
  - Push-to-talk nebo voice-activity detection (VAD)
  - Podpora češtiny (Whisper je přesný pro češtinu)
  - Implementace: Whisper edge funkce (`whisper-stt`) + úprava ChatInterface
  - Možné rozšíření: wake word ("Hej Marku" / "Hej Vero") pro hands-free provoz na RPi

## 🗓️ Fáze 3.5: Individuální Tréninkové Plány (v1.3.0)
*Cíl: AI zná kalendář dopředu (1 měsíc) a sestavuje personalizované tréninkové plány na míru – závody, zdravotní cíle, longevity.*

### Kalendář dopředu
- [ ] AI načítá Google Calendar 1 měsíc dopředu (ne jen dnes) – detekuje závody, события jako "Gladiator Run", volné dny, pracovní vytížení.
- [ ] Periodická kontrola kalendáře (1x denně) – asistent proaktivně upozorní na blížící se závod / cíl.

### Databáze a datový model
- [ ] Tabulka `training_plans` (id, user_id, title, goal, start_date, end_date, phases, status, created_by_ai).
- [ ] Tabulka `plan_exercises` (id, plan_id, phase, day, exercise_name, sets, reps, rest, alternatives, notes).
- [ ] Knihovna cviků s popisy a náhradami (fitko, doma, venku) – základní seed data.

### UI – karta "Individuální plán" v Trenérovi
- [ ] Zobrazení aktivního plánu: název, cíl, postup (dny zbývají do závodu).
- [ ] Týdenní přehled tréninků s detailem (cviky, série, opakování, alternativy).
- [ ] Fázové zobrazení plánu (příprava → rozvoj → špička → tapering).
- [ ] Editace plánu: přidání/odebrání cviku, změna dne, poznámka.
- [ ] Rychlé přepnutí: "Dnes mám plán" / "Přeskočit dnešek" / "Zranění – upravit plán".

### AI generování a adaptace
- [ ] Chat příkaz: "Připrav plán na Gladiator Run 15.3." → AI vygeneruje strukturovaný plán s fázemi.
- [ ] Chat příkaz: "Bolí mě rameno" → AI upraví plán (náhrady cviků, vynechání horní části těla).
- [ ] Plan utilizes: CTL/ATL/TSB, VO2max, věk, BMR, váha, spánkové záznamy, výživa (makra).
- [ ] Predikce pokroku: "Za 6 týdnů s tímto plánem dosáhneš CTL ~65 a VO2max ~52."
- [ ] Podpora typů plánů:
  - Závod / výkon (běh, cyklistika, triathlon, Gladiator Run)
  - Posilování a fitko (fázový trénink: hypertrofie → síla → deload)
  - Cviky s popisem a náhradami (bench press → tlaky s jednoručkami / kliky)
  - Rehabilitace / zranění (omezení pohybů, šetrný trénink)
  - Longevity (zdravé stárnutí, pohyblivost, kardio, síla, stres)

### Longevity (v rámci plánů i jako standalone karta)
- [ ] Karta "Longevity" v Trenérovi: přehled klíčových indikátorů zdravého stárnutí.
  - Průměrná délka spánku (trend posledních 7 dní)
  - HRV (variabilita srdeční frekvence) pokud dostupná ze Stravy
  - VO2max trend (zlepšení / stagnace / pokles za posledních 30 dní)
  - TSB (stres balance) – přetrénovanost vs. podtrénovanost
  - BMI + tělesné složení (váha / výška z profilu)
  - Kalorická bilance (průměr týdne z výživy)
  - "Longevity score" – jednoduchý agregovaný ukazatel 0–100
- [ ] Doporučení AI na základě longevity dat: "Tvůj VO2max klesá – přidej 2x týdně zónový běh."

## 🏠 Fáze 4: Lokální Mozek (MarkVera Offline)
*Cílový stav: Běh na RPi 5 bez závislosti na cloudu.*
- [ ] **Hardware**: RPi 5 + NVMe SSD + Coral TPU (volitelně).
- [ ] **Lokální LLM**: Ollama (Llama 3 / Mistral) běžící přímo na RPi.
- [ ] **Hlasový Server**: Python backend na RPi nahrazující Supabase Edge Functions.
- [ ] **Voice Client**: Mikrofon + Reproduktor ovládaný lokálně.

## 📦 Backlog vylepšení
- [x] Vizualizace makroživin – MacroNutritionCharts (hotovo v 1.2.0).
- [ ] 3D vizualizace svalových skupin.
- [ ] Správa vozového parku (servis, STK).
- [ ] Zálohování: stabilní tag + lokální archiv po každé funkční verzi.
- [ ] **Email doména**: Ověřit `markvera.cz` v Resend → emaily budou chodit všem uživatelům z `noreply@markvera.cz`.
- [x] **Supabase Sleep/Resume**: jak zabránit uspání projektu a jak ho obnovit.
  - **Obnova**: Supabase Dashboard → Project → Resume (nebo otevřít projekt v dashboardu a potvrdit).
  - **Prevence**: GitHub Actions cron každé 3 dny pinguje `/functions/v1/keep-alive` (edge funkce deploynutá).
