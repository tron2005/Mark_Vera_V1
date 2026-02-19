#!/bin/bash

# Jednoduchý skript pro spuštění serveru
# Spusť: ./scripts/spustit-server.sh

set -e

cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera

echo "🚀 Spouštím server..."
echo ""

# Zastavit všechny staré procesy
echo "1️⃣ Zastavuji staré procesy..."
lsof -ti:3000,3001,3002,3003 | xargs kill -9 2>/dev/null || echo "Žádné staré procesy"
sleep 2

# Smazat Vite cache
echo ""
echo "2️⃣ Mažu cache..."
rm -rf node_modules/.vite dist
echo "✅ Cache smazána"

# Spustit server
echo ""
echo "3️⃣ Spouštím server..."
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Server se spustí za chvíli..."
echo "  Počkej na zprávu: 'Local: http://localhost:XXXX/'"
echo "  Pak otevři ten port v prohlížeči!"
echo ""
echo "  Pro zastavení stiskni: Ctrl+C"
echo "═══════════════════════════════════════════════════════════"
echo ""

npm run dev
