#!/bin/bash

# MarkVera - Robustní Start Skript v2.0
# Automaticky řeší: zaseklé procesy, plný disk, poškozená cache
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 MarkVera Start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Zdravotní kontrola disku
AVAIL_GB=$(df -g /System/Volumes/Data 2>/dev/null | tail -1 | awk '{print $4}' || echo "99")
if [ "$AVAIL_GB" -lt 5 ] 2>/dev/null; then
  echo "⚠️  POZOR: Málo místa na disku! (${AVAIL_GB} GB volných)"
  echo "   Doporučení: Vysypte Koš a smažte nepotřebné soubory."
  echo ""
fi

# 2. Zastavení starých procesů
echo "🛑 Zastavuji staré procesy..."
# Zabít zaseklé esbuild procesy (hlavní příčina zamrzání!)
pkill -f "esbuild.*--service" 2>/dev/null || true

# Uvolnit porty
for port in 3500 3501 3502 5173; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "   Port $port obsazen (PID: $pid) → ukončuji"
    kill -9 $pid 2>/dev/null || true
  fi
done

# 3. Kontrola node_modules
if [ ! -d "node_modules/.bin" ] || [ ! -f "node_modules/.bin/vite" ]; then
  echo "📦 Chybí závislosti, instaluji..."
  npm install
fi

# 4. Čištění cache (pokud požadováno, nebo pokud je málo místa)
if [ "${CLEAN:-}" = "1" ] || [ "$AVAIL_GB" -lt 3 ] 2>/dev/null; then
  echo "🧹 Čištění cache..."
  rm -rf node_modules/.vite
  rm -rf dist
fi

# 5. Start
echo ""
echo "🚀 Spouštím MarkVera..."
echo "   Adresa: http://127.0.0.1:3500"
echo "   Pro zastavení: Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exec ./node_modules/.bin/vite --host 127.0.0.1 --port 3500 --strictPort --open
