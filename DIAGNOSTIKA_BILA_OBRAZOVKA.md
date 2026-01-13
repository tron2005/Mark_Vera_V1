# 🔍 Diagnostika: Bílá obrazovka

## ✅ Co jsem zkontroloval

1. ✅ Opravil duplikovaný import v `main.tsx`
2. ✅ Server běží na portu 3001 nebo 3002
3. ✅ .env soubor existuje

## 🔴 Problém

Bílá obrazovka znamená, že aplikace má chybu při načítání. Může to být:

1. **Chybějící nebo špatné proměnné prostředí** v `.env`
2. **Chyba v konzoli prohlížeče** (JavaScript error)
3. **Server běží na jiném portu** než očekáváš

## ✅ Řešení

### Krok 1: Zjisti, na jakém portu server běží

V terminálu, kde běží `npm run dev`, uvidíš:
```
➜  Local:   http://localhost:XXXX/
```

**Otevři ten port v prohlížeči!**

### Krok 2: Otevři konzoli prohlížeče

1. **Stiskni F12** (nebo Cmd+Option+I na Mac)
2. **Jdi na záložku "Console"**
3. **Podívej se na chyby** (červené texty)

**Zkopíruj mi všechny chyby z konzole!**

### Krok 3: Zkontroluj .env soubor

Ujisti se, že máš v `.env`:
```
VITE_SUPABASE_URL=https://rtuczjobfpqmptfofgkt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

**Pokud chybí, přidej je!**

## 🆘 Pokud to stále nefunguje

**Pošli mi:**
1. **Port, na kterém server běží** (z terminálu)
2. **Všechny chyby z konzole prohlížeče** (F12 → Console)
3. **Výstup z terminálu** (kde běží `npm run dev`)
