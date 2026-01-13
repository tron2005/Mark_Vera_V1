# 🔧 OPRAVA: Frontend import chyba

## 🔴 Problém

Frontend se nespustí kvůli chybě:
```
Failed to resolve import "@/components/ui/toaster" from "src/App.tsx"
```

## ✅ Řešení

Pravděpodobně jsme smazali nějaké soubory při git operacích (`git clean`).

### Možnost 1: Obnovit ze stash

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
git stash pop
```

### Možnost 2: Reinstalovat závislosti

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
rm -rf node_modules
npm install
```

### Možnost 3: Vrátit se na main branch

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
git checkout main
```

## ⏳ Prosím počkej

Zjišťuji, co se stalo...
