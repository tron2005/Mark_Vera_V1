#!/bin/bash

# Spuštění serveru na čistě
# Spusť: ./scripts/spustit-server-ciste.sh

set -e

echo "🚀 Spouštění serveru na čistě"
echo "=============================="
echo ""

cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera

# Krok 1: Zastavit všechny procesy
echo "1️⃣ Zastavuji všechny procesy..."
lsof -ti:3000,3001,3002,3003 | xargs kill -9 2>/dev/null || echo "Žádné procesy"
sleep 2

# Krok 2: Smazat Vite cache
echo ""
echo "2️⃣ Mažu Vite cache..."
rm -rf node_modules/.vite
echo "✅ Vite cache smazána"

# Krok 3: Spustit server
echo ""
echo "3️⃣ Spouštím server..."
echo ""
echo "Server se spustí na: http://localhost:3000"
echo "Stiskni Ctrl+C pro zastavení"
echo ""

npm run dev
