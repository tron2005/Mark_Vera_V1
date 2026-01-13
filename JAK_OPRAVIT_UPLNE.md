# 🔧 JAK OPRAVIT ÚPLNĚ - KOMPLETNÍ PŘEINSTALACE

## 🔴 Problém

Server se nespouští ani po návratu na funkční verzi z gitu. To znamená, že problém je v prostředí (node_modules, cache), ne v kódu.

## ✅ Řešení - KOMPLETNÍ PŘEINSTALACE

### Krok 1: Spusť skript v terminálu

**Otevři terminál a zadej:**

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
./scripts/kompletni-reinstall.sh
```

### Krok 2: Počkej na instalaci

**Instalace může trvat 1-2 minuty.** Uvidíš:
```
🔧 KOMPLETNÍ PŘEINSTALACE
=========================

1️⃣ Zastavuji všechny procesy...
✅ Procesy zastaveny

2️⃣ Mažu node_modules, cache, dist...
✅ Vše smazáno

3️⃣ Instaluji závislosti (může trvat 1-2 minuty)...
... (stahování balíčků) ...
✅ Závislosti nainstalovány

4️⃣ Spouštím server...
```

### Krok 3: Počkej na server

**Měla by se zobrazit zpráva:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

### Krok 4: Otevři v prohlížeči

**Otevři v prohlížeči port, který vidíš v terminálu** (např. `http://localhost:3000`)

## ✅ Hotovo!

Po kompletní přeinstalaci by měl server fungovat!

## 🆘 Pokud to stále nefunguje

**Pošli mi:**
1. Výstup z terminálu (celou zprávu)
2. Screenshot z prohlížeče
3. Chyby z konzole prohlížeče (F12 → Console)
