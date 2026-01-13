# 🔧 Oprava: Server nefunguje na žádném portu

## 🔴 Problém

Server neodpovídá na žádném portu. Možné příčiny:
1. Server neběží správně
2. Problém s oprávněními macOS pro místní síť
3. Server má chybu při startu

## ✅ Řešení

### Krok 1: Spusť server ručně v terminálu

**V terminálu zadej:**

```bash
cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera
npm run dev
```

### Krok 2: Počkej na zprávu

**Měla by se zobrazit zpráva:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:XXXX/
```

**Zkopíruj mi celý výstup z terminálu!**

### Krok 3: Otevři správný port

**Otevři v prohlížeči port, který vidíš v terminálu** (např. `http://localhost:3000`)

### Krok 4: Pokud vidíš chybu v terminálu

**Zkopíruj mi celou chybovou hlášku z terminálu!**

## 🆘 Pokud to stále nefunguje

**Zkontroluj oprávnění macOS:**

1. **Jdi do: Systémová nastavení → Soukromí a zabezpečení → Místní síť**
2. **Ujisti se, že Firefox má povolený přístup k místní síti**
3. **Zkus znovu otevřít port v prohlížeči**

## ✅ Hotovo!

Po spuštění serveru by měl fungovat na portu, který vidíš v terminálu.
