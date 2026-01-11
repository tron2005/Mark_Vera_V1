# 🛠️ Vývojářský Průvodce

## Spuštění aplikace

### Standardní spuštění
```bash
npm run dev
```

### Bezpečné spuštění (doporučeno)
Pokud máte problém s obsazeným portem 3000, použijte:
```bash
npm run dev:clean
```

Tento příkaz automaticky:
- Zkontroluje, zda je port 3000 volný
- Ukončí staré procesy na portu 3000, pokud tam nějaké běží
- Spustí nový dev server

### Ruční řešení problémů s portem

Pokud port 3000 stále není volný:

1. **Zkontrolovat, co běží na portu 3000:**
   ```bash
   lsof -i:3000
   ```

2. **Ukončit procesy na portu 3000:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

3. **Nebo ukončit všechny Vite procesy:**
   ```bash
   pkill -f vite
   ```

## Časté problémy

### Port 3000 je obsazen
- **Příčina:** Starý proces z předchozího spuštění nezůstal ukončen
- **Řešení:** Použijte `npm run dev:clean` nebo ručně ukončete procesy (viz výše)

### Aplikace nefunguje v prohlížeči
1. Ověřte, že server běží: `lsof -i:3000 | grep LISTEN`
2. Zkuste hard refresh: `Cmd+Shift+R` (Mac) nebo `Ctrl+Shift+R` (Windows/Linux)
3. Zkontrolujte konzoli prohlížeče (F12) pro chyby
4. Ověřte, že se připojujete na správný port (mělo by být `http://localhost:3000`)

### Server běží na jiném portu
Pokud Vite najde port 3000 obsazený, automaticky zkusí 3001, 3002 atd.
- Zkontrolujte výstup v terminálu - uvidíte tam správný port
- Nebo použijte `npm run dev:clean` pro použití portu 3000

## Struktura projektu

- `src/` - Zdrojový kód aplikace
- `supabase/` - Supabase konfigurace a funkce
- `scripts/` - Pomocné skripty
- `.env` - Environment proměnné (není v gitu)

## Technologie

- **Frontend:** React + Vite + TypeScript
- **Backend:** Supabase (produkční)
- **UI:** Shadcn/ui + Tailwind CSS
