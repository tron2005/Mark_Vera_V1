# 🔍 Debug: Chyba při volání AI

## 🔴 Co vidím

V konzoli:
- `Calendar: true` - chat se stále pokouší použít Google Calendar
- `Tool create-calendar-event returned. Success: true` - myslí si, že událost vytvořil
- "Chyba při volání AI" - zobrazí se chyba

## 🔍 Možné příčiny

1. **Edge Function se ještě neaktualizovala** - Supabase může mít delay při aktualizaci
2. **Kontrola nefunguje správně** - možná profil nemá načtené Google tokeny
3. **Chyba je jinde** - problém může být v follow-up requestu do OpenAI

## ✅ Co zkusit

### 1. Počkat 30 sekund a zkusit znovu

Edge Function se může aktualizovat s malým zpožděním.

### 2. Zkusit nový chat

Vytvořit novou konverzaci (nový chat).

### 3. Zkontrolovat, jestli má profil Google tokeny

Jdi do Nastavení a podívej se, jestli je Google Calendar připojený.

## 🔍 Co zjistím

Zkontoluji, jestli je oprava skutečně nasazená a funguje správně.
