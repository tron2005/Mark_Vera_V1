# 🔧 Oprava: Vite moduly se nenačítají

## 🔴 Problém

V konzoli jsou chyby:
- `Načtení modulu ze zdroje „http://localhost:3002/@vite/client" se nezdařilo.`
- `Načtení modulu ze zdroje „http://localhost:3002/src/main.tsx" se nezdařilo.`
- `Načtení modulu ze zdroje „http://localhost:3002/@react-refresh" se nezdařilo.`

**To znamená, že server běží, ale neposílá správně Vite moduly.**

## ✅ Řešení

### Krok 1: Zastav server

**V terminálu, kde běží `npm run dev`, stiskni `Ctrl+C`**

### Krok 2: Smazat cache a spustit znovu

**V terminálu zadej:**

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera

# Smazat Vite cache
rm -rf node_modules/.vite dist

# Spustit server znovu
npm run dev
```

### Krok 3: Počkej na zprávu

**Měla by se zobrazit zpráva:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:XXXX/
```

### Krok 4: Otevři správný port

**Otevři v prohlížeči port, který vidíš v terminálu** (např. `http://localhost:3000`)

**DŮLEŽITÉ: Otevři port, který vidíš v terminálu, ne port 3002!**

### Krok 5: Obnov stránku

**V prohlížeči stiskni `F5` nebo `Cmd+R`** pro obnovení stránky

## 🆘 Pokud to stále nefunguje

**Zkopíruj mi:**
1. **Výstup z terminálu** (kde běží `npm run dev`)
2. **Všechny chyby z konzole prohlížeče** (F12 → Console)

## ✅ Hotovo!

Po spuštění serveru na čistě by měl fungovat správně.
