#!/bin/bash

# Skript pro bezpečné spuštění dev serveru
# Zkontroluje a ukončí staré procesy na portu 3000

PORT=3000

echo "🔍 Kontroluji port $PORT..."

# Najdi procesy na portu 3000
PIDS=$(lsof -ti:$PORT 2>/dev/null)

if [ ! -z "$PIDS" ]; then
    echo "⚠️  Na portu $PORT běží proces(y): $PIDS"
    echo "🛑 Ukončuji staré procesy..."
    echo $PIDS | xargs kill -9 2>/dev/null
    sleep 1
    echo "✅ Staré procesy ukončeny"
else
    echo "✅ Port $PORT je volný"
fi

# Zkontroluj, že port je opravdu volný
PIDS_AFTER=$(lsof -ti:$PORT 2>/dev/null)
if [ ! -z "$PIDS_AFTER" ]; then
    echo "❌ Port stále obsazen, zkus: lsof -ti:$PORT | xargs kill -9"
    exit 1
fi

echo "🚀 Spouštím dev server..."
npm run dev
