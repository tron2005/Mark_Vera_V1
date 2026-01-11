#!/bin/bash

# Skript pro rychlé nastavení Supabase projektu
# Použití: ./scripts/setup-supabase.sh

set -e

echo "🚀 MarkVera - Supabase Setup"
echo "=============================="
echo ""

# Kontrola Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI není nainstalováno!"
    echo ""
    echo "Instalace:"
    echo "  macOS: brew install supabase/tap/supabase"
    echo "  nebo: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI nalezeno"
echo ""

# Kontrola .env souboru
if [ ! -f .env ]; then
    echo "⚠️  Soubor .env neexistuje!"
    echo "Vytvoř .env soubor s těmito proměnnými:"
    echo "  VITE_SUPABASE_URL=..."
    echo "  VITE_SUPABASE_PUBLISHABLE_KEY=..."
    echo "  OPENAI_API_KEY=..."
    echo ""
    read -p "Chceš pokračovat? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Načtení Project ID z .env
if [ -f .env ]; then
    SUPABASE_URL=$(grep VITE_SUPABASE_URL .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [ -z "$SUPABASE_URL" ]; then
        echo "❌ VITE_SUPABASE_URL není v .env souboru"
        exit 1
    fi
    
    # Extrahovat Project ID z URL
    PROJECT_ID=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co||')
    echo "📋 Detekovaný Project ID: $PROJECT_ID"
    echo ""
fi

# Login kontrola
echo "🔐 Kontrola přihlášení do Supabase..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Nejsi přihlášen do Supabase"
    echo "Spusť: supabase login"
    exit 1
fi

echo "✅ Přihlášen do Supabase"
echo ""

# Link projektu
if [ ! -z "$PROJECT_ID" ]; then
    echo "🔗 Linkování projektu..."
    supabase link --project-ref "$PROJECT_ID" || {
        echo "⚠️  Projekt už může být linknutý, nebo Project ID není správné"
    }
    echo ""
fi

# Push migrací
echo "📦 Aplikování migrací..."
read -p "Chceš aplikovat všechny migrace? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase db push
    echo "✅ Migrace aplikovány"
    echo ""
fi

# Secrets
echo "🔑 Nastavení secrets pro Edge Functions..."
echo "Potřebuješ nastavit:"
echo "  - OPENAI_API_KEY"
echo "  - STRAVA_CLIENT_ID (volitelné)"
echo "  - STRAVA_CLIENT_SECRET (volitelné)"
echo "  - OPENWEATHER_API_KEY (volitelné)"
echo "  - TAVILY_API_KEY (volitelné)"
echo ""
read -p "Chceš nastavit secrets teď? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f .env ]; then
        # Načíst OPENAI_API_KEY z .env
        OPENAI_KEY=$(grep OPENAI_API_KEY .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | head -1)
        if [ ! -z "$OPENAI_KEY" ]; then
            echo "Nastavuji OPENAI_API_KEY..."
            supabase secrets set OPENAI_API_KEY="$OPENAI_KEY"
        fi
    fi
    echo "💡 Pro další secrets použij: supabase secrets set KEY=value"
    echo ""
fi

# Deploy functions
echo "🚀 Deploy Edge Functions..."
read -p "Chceš deploynout všechny Edge Functions? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    supabase functions deploy
    echo "✅ Functions deploynuté"
    echo ""
fi

echo "✅ Setup dokončen!"
echo ""
echo "📝 Další kroky:"
echo "  1. Zkontroluj, že všechny migrace byly aplikovány"
echo "  2. Otestuj přihlášení v aplikaci"
echo "  3. Zkontroluj, že preferences fungují v Nastavení"
echo ""
