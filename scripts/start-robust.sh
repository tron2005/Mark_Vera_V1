#!/bin/bash

# Zastavení při chybě
set -e

echo "🛑 Zastavuji staré procesy..."
# Najdi a ukonči procesy na portech 3500-3505
for port in {3500..3505}; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ ! -z "$pid" ]; then
    echo "   Killing process on port $port (PID: $pid)"
    kill -9 $pid 2>/dev/null || true
  fi
done

if [ "${CLEAN:-}" = "1" ]; then
  echo "🧹 Čištění cache..."
  rm -rf node_modules/.vite
  rm -rf dist
else
  echo "ℹ️  Přeskakuji čištění cache (rychlejší start)"
fi

echo "🚀 Spouštím MarkVera (vynucený port 3500)..."
# Spustí vite s explicitním nastavením
# --host: běží lokálně, bez problémů s oprávněním
# --port 3500: fixní port
# --strictPort: pokud je obsazen, spadne (ale my jsme ho uvolnili)
# --force: vynutí re-optimalizaci závislostí
exec npx vite --host 127.0.0.1 --port 3500 --strictPort
