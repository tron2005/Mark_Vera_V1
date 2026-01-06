# 🤖 MarkVera - AI Fitness & Wellness Assistant

MarkVera je pokročilý osobní asistent navržený pro běh na Raspberry Pi 5, který kombinuje fitness trénink ("M.A.R.K.") s empatickým wellness coachingem ("V.E.R.A.").

## 🚀 O Projektu

Tento projekt vznikl oddělením od platformy Lovable a nyní je vyvíjen nezávisle s cílem plné lokální funkčnosti.

**Hlavní funkce:**
- **M.A.R.K.** (My Assistant Raspberry Kit): Technický, datově orientovaný trenér.
- **V.E.R.A.** (Voice Enhanced Raspberry Assistant): Empatická, pečující wellness asistentka.
- **AI Chat**: Inteligentní konverzace poháněná OpenAI (GPT-4o).
- **Fitness Tracking**: Integrace se Stravou, sledování váhy, kalorií (včetně jídla).
- **Lokální Běh**: Optimalizováno pro nasazení na RPi 5.

## 🛠 Technologie

- **Frontend**: React, Vite, TypeScript
- **UI**: Shadcn/ui, Tailwind CSS
- **Backend & DB**: Supabase
- **AI**: OpenAI API

## 📦 Instalace a Spuštění

1.  **Klonování repozitáře:**
    ```bash
    git clone https://github.com/tron2005/Mark_Vera_V1.git
    cd Mark_Vera_V1
    ```

2.  **Instalace závislostí:**
    ```bash
    npm install
    ```

3.  **Konfigurace:**
    - Vytvořte soubor `.env` podle `.env.example`.
    - Doplňte `OPENAI_API_KEY` a klíče pro Supabase.

4.  **Spuštění:**
    ```bash
    npm run dev
    ```
    Aplikace poběží na `http://localhost:3000`.

## 🤝 Vývoj

Projekt je nyní spravován v tomto GitHub repozitáři. Veškeré změny commiujeme přímo sem.
