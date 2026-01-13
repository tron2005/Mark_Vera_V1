#!/bin/bash

# Kompletní přeinstalace a spuštění
# Spusť: ./scripts/kompletni-reinstall.sh

set -e

echo "🔧 KOMPLETNÍ PŘEINSTALACE"
echo "========================="
echo ""

cd /Users/zdeneksailer/Documents/Antigravity_Projekty/markvera

# Krok 1: Zastavit všechny procesy
echo "1️⃣ Zastavuji všechny procesy..."
pkill -9 -f "node" 2>/dev/null || echo "Žádné procesy"
pkill -9 -f "vite" 2>/dev/null || echo "Žádné vite procesy"
pkill -9 -f "npm" 2>/dev/null || echo "Žádné npm procesy"
sleep 2
echo "✅ Procesy zastaveny"

# Krok 2: Smazat vše
echo ""
echo "2️⃣ Mažu node_modules, cache, dist..."
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm -rf node_modules/.vite
rm -f package-lock.json
echo "✅ Vše smazáno"

# Krok 3: Přeinstalovat závislosti
echo ""
echo "3️⃣ Instaluji závislosti (může trvat 1-2 minuty)..."
npm install
echo "✅ Závislosti nainstalovány"

# Krok 4: Spustit server
echo ""
echo "4️⃣ Spouštím server..."
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
