# 🔧 PLÁN FINÁLNÍ OPRAVY

## 🔴 Problém

Stále "Chyba při volání AI" - kalendářový tool se spouští, i když by neměl.

## ✅ Řešení

Nejjednodušší a nejbezpečnější řešení:

### Úplně ODSTRANIT Google Calendar tool z dostupných nástrojů, pokud není připojený

Místo kontroly v různých místech kódu, jednoduše:
1. **Nekontrolovat `shouldForceCalendar`** - to je složité
2. **ODSTRANIT `create_calendar_event` tool z pole `tools`**, pokud není Google Calendar připojený
3. Tím se kalendářový tool NIKDY nespustí, pokud není připojení

## 📝 Co udělám

1. Upravím část, kde se vytváří pole `tools`
2. Přidám podmínku: pokud `hasGoogleCalendar` je false, NEOBSAHUJ `create_calendar_event`
3. Odstraním všechny `shouldForceCalendar` kontroly - nepotřebujeme je

## ✅ Výhody

- **Jednodušší kód** - méně kontrol
- **Bezpečnější** - tool se NIKDY nespustí, pokud není připojení
- **Rychlejší** - méně logiky

## ⏳ Prosím počkej

Opravuji to teď bezpečným způsobem...
