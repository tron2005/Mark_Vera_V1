# 🚀 Jak spustit server - JEDNODUCHÉ INSTRUKCE

## ✅ Spuštění serveru (doporučeno)

### Krok 1: Otevři terminál

**V Antigravity (nebo v Terminálu) otevři nový terminál**

### Krok 2: Přejdi do složky projektu

**Zadej:**
```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
```

### Krok 3: Spusť server (stabilní režim)

**Zadej:**
```bash
npm run start:stable
```

### Krok 4: Počkej na zprávu

**Měla by se zobrazit zpráva:**
```
Serving HTTP on :: port 5173 (http://[::]:5173/) ...
```

### Krok 5: Otevři v prohlížeči

**Otevři:** `http://127.0.0.1:5173`

## 🛑 Zastavení serveru

**V terminálu, kde běží server, stiskni:**
```
Ctrl+C
```

## 🔄 Pokud server neběží

**Zkus tento skript:**
```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
npm run start:stable
```

## ℹ️ Dev režim (pouze pro vývojáře)

Pokud chceš hot‑reload, můžeš zkusit:
```bash
npm run dev
```
Ale stabilní režim je spolehlivější.

## ✅ Hotovo!

Po spuštění by měl server běžet a aplikace by měla fungovat!
