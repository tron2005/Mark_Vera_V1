# Changelog

Všechny významné změny v projektu MarkVera budou dokumentovány v tomto souboru.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.0.0/),
a projekt dodržuje [Semantic Versioning](https://semver.org/lang/cs/).

## [1.3.0] - 2026-02-21

### Přidáno
- **Fáze 3.5: Individuální tréninkové plány**:
  - Tabulka `training_plans` v Supabase (JSONB `plan_data`, RLS, migrace)
  - Nová záložka "Plány" v Trenérovi (`TrainerPlans.tsx`)
    - Prázdný stav s ukázkovými příkazy pro chat
    - Aktivní plán: název, cíl, stav, dny do závodu
    - Fázový přehled (rozbalovací) s dnešním tréninkem zvýrazněným
    - Akce: pozastavit / dokončit / smazat / obnovit
    - Realtime synchronizace
  - 3 nové AI nástroje: `create_training_plan`, `get_active_training_plan`, `update_training_plan`
  - AI zná přesné tempo z dat Stravy (výpočet Z2 = průměr + 45s/km)
  - Každý silový cvik s alternativou bez nářadí (`[BEZ HRAZDY: ...]`)
  - Zóny Z1–Z4 vždy vysvětleny lidsky (HR rozsah + tempo + slovní popis)
  - Intervaly vždy s konkrétním cílovým tempem (ne jen "rychle")
  - Adaptace plánu: věk 40+, TSB, zranění/nemoc, pokrok (pravidlo 10%/týden)
  - Post-workout analýza: po tréninku načte Strava, porovná s plánem
- **OCR/Gladiator Run** – rozšířená knihovna překážek:
  - Gladiator Run: monkey bars, wall climb, rope climb, tire flip, atlas ball carry...
  - Spartan Race: spear throw, bucket carry, Hercules hoist, sandbag carry...
  - OCR silový trénink a běžecká příprava, výživa na závodní den

### Opraveno
- **Chat race condition**: temp asistenta se zobrazoval NAD uživatelovou otázkou
  - User message + temp assistant přidány dohromady jedním `setMessages` voláním
  - Realtime INSERT pro `role="user"` přeskočen (optimistické přidání)
- **Dvojitá karta při načítání**: odstraněn samostatný `isLoading` spinner card
  - Spinner se zobrazuje přímo v temp assistant kartě (prázdný obsah)
  - Tlačítko hlasu skryto dokud asistent nemá obsah

## [1.2.0] - 2026-02-21

### Přidáno
- **MacroNutritionCharts**: grafy makroživin (bílkoviny, sacharidy, tuky, kalorie)
- **AI kontext makronutrientů**: týdenní průměry dostupné asistentovi
- **Krevní tlak**: widget s WHO klasifikací, trendem, AI kontextem

## [1.1.0] - 2026-02-20

### Přidáno
- **Pokročilá analytika (Fáze 2B)**:
  - Advanced Metrics Widget (TRIMP, ATL, CTL, TSB, VO2max)
  - Performance Management Chart (PMC) s vizualizací zatížení
  - Automatická denní synchronizace Strava aktivit
- **Design Refresh (Fáze 2A)**:
  - Barevné rozlišení typů aktivit
  - Gradient hero sekce s motivačním citátem
  - Micro-animace (fade-in, hover efekty, progress bary)
  - Dark mode s přepínačem v nastavení
  - Klikatelné aktivity s detailním dialogem
  - Responsivní design pro mobily
- **Zobrazení poslední synchronizace** na stránce Konektory s přesným datem a časem
- **Verzovací systém**: NPM skripty pro bump verzí (patch/minor/major)

### Opraveno
- **Strava integrace**: Kompletně přepracována po odpojení od Lovable
  - Edge funkce s `--no-verify-jwt` a service role klíčem
  - Automatický refresh OAuth tokenů
  - Rate limit handling
- **Start aplikace**: Robustní skript s auto-cleanup zombie procesů
- **ErrorBoundary**: Auto-recovery pro DOM chyby z browser extensions
- **Počasí tlačítko**: Fungující integrace s OpenWeather API

### Změněno
- Rozdělení karty Trenér na záložky: Výkon, Výživa, Longevity, Knihovna, Konektory
- Oddělení logování jídla od poznámek
- České překlady typů aktivit v UI

## [1.0.0] - 2026-01-15

### Přidáno
- Iniciální release MarkVera
- Základní Strava integrace
- AI Chat s OpenAI (GPT-4o)
- Sledování váhy a kalorií
- Google Calendar a Gmail integrace
- Web Search (Tavily API)
- Supabase backend s Edge Functions

---

## Jak aktualizovat verzi

```bash
# Oprava chyby (1.1.0 → 1.1.1)
npm run version:patch

# Nová funkce (1.1.0 → 1.2.0)
npm run version:minor

# Breaking change (1.1.0 → 2.0.0)
npm run version:major

# Push verzí a tagů do GitHubu
npm run version:tag
```
