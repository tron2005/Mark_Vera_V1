#!/bin/bash
set -e

echo "🛑 Zastavuji staré procesy..."
# Zastavit server na portu 5173
pid=$(lsof -ti:5173 2>/dev/null || true)
if [ -n "$pid" ]; then
  kill -9 "$pid" 2>/dev/null || true
fi

# Zastavit zaseknuté esbuild procesy
pkill -f "esbuild" || true

echo "🧹 Čistím cache..."
rm -rf node_modules/.vite

echo "📦 Build aplikace..."
npm run build

echo "🚀 Spouštím stabilní server na http://127.0.0.1:5173 ..."
exec python3 -m http.server 5173 --directory dist
