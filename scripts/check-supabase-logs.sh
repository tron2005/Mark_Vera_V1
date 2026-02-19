#!/bin/bash

# Kontrola Supabase logů pro chat funkci
# Spusť: ./scripts/check-supabase-logs.sh

echo "📋 Načítám poslední logy z chat funkce..."
echo ""

supabase functions logs chat --limit 50

echo ""
echo "✅ Hotovo"
