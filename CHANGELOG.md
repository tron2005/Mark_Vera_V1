# Changelog

Všechny významné změny v projektu MarkVera budou dokumentovány v tomto souboru.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.0.0/),
a projekt dodržuje [Semantic Versioning](https://semver.org/lang/cs/).

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
