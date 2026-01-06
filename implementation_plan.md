# Plán Implementace M.A.R.K. / V.E.R.A.

Tento dokument slouží jako roadmapa pro převzetí a vylepšení projektu MarkVera.

## Fáze 1: Kritické Opravy a Základy (Priority)

### 1. Oprava Logování Jídla (Cíl: Zamezit míchání s poznámkami)
- [ ] **Databáze**: Vytvořit novou tabulku `food_logs` v Supabase (datum, název jídla, kalorie, makra).
- [ ] **Backend (AI Tool)**: Vytvořit novou funkci/nástroj `log_food_item` v `supabase/functions/chat/index.ts`.
- [ ] **System Prompt**: Upravit instrukce pro AI, aby pro jídlo VŽDY používala tento nový nástroj a ne `add_note`.

### 2. Osobnosti (Mark vs. Vera)
- [ ] **Backend**: Upravit `supabase/functions/chat/index.ts` pro podporu dvou režimů:
    - **Mark**: Technický, stručný, trenérský styl (muž).
    - **Vera**: Empatická, pečující, mateřská ale i přísná trenérka (žena).
- [ ] **Frontend**: Přidat přepínač "Osobnost" do `Settings.tsx`.
- [ ] **State**: Zajistit, aby se volba osobnosti posílala s každým požadavkem na chat.

## Fáze 2: Refaktoring Rozhraní (UI)

### 3. Rozdělení karty "Trenér"
- [ ] **Nová Komponenta**: Vytvořit `Connectors.tsx` (nebo `Integrations.tsx`).
- [ ] **Migrace**: Přesunout logiku importů (Garmin, Strava, CSV) a stavy připojení z `FitnessTrainer.tsx` do nové komponenty.
- [ ] **Čistka**: `FitnessTrainer.tsx` ponechat pouze pro grafy, statistiky a "Body Battery" vizualizace.
- [ ] **Navigace**: Přidat novou záložku do hlavního menu v `Index.tsx`.

## Fáze 3: Inteligence a Kontext

### 4. Celkový Přehled Dat (AI čte vše)
- [ ] **Backend**: Vytvořit nástroj `get_fitness_summary`, který pro AI agreguje data z tabulek (běh, spánek, váha, jídlo) za poslední období.
- [ ] **Integrace**: Umožnit AI, aby si tato data "přečetla" před odpovědí na dotaz typu "jak si vedu?".

### 5. Dlouhodobá Paměť a Denní Shrnutí
- [ ] **Testování**: Ověřit funkčnost existujícího `create_summary`.
- [ ] **Vylepšení**: Zajistit, aby "večerní shrnutí" správně kategorizovalo pracovní vs. soukromé věci (upravit prompt pro summary).


## Fáze 4: Lokální Mozek na RPi 5 (True Offline/Hybrid)
 *Tato fáze přesouvá inteligenci z cloudu přímo na tvé RPi 5.*
 
- [ ] **Hardware & OS**: RPi 5 s 8GB RAM (doporučeno), NVMe SSD pro rychlost.
- [ ] **Lokální LLM Server**:
    - Instalace **Ollama** na RPi (`curl -fsSL https://ollama.com/install.sh`).
    - Stažení modelu (např. `llama3-chatqa:8b` nebo `mistral-nemo:12b` pro češtinu).
- [ ] **Náhrada Cloud Funkce**:
    - Vytvořit Python server (FastAPI) `rpi_brain_server.py`, který nahradí logiku v `supabase/functions/chat/index.ts`.
    - Tento server bude přijímat text/hlas, volat lokální Ollama API a vykonávat nástroje (kalendář, poznámky) lokálně nebo přes API.
- [ ] **Voice Client Update**:
    - Upravit `rpi_voice_client.py`, aby posílal rozpoznaný text na `http://localhost:8000/chat` místo jednoduchého if/else.

