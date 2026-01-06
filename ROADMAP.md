# MarkVera Roadmap v1.0.1 🚀

Projekt se transformuje z testovací aplikace na plnohodnotného asistenta M.A.R.K. & V.E.R.A. s cílem běžet lokálně na Raspberry Pi 5.

## 🏆 Fáze 1: Stabilizace a Základy (Hotovo / Probíhá)
- [x] Převzetí projektu a inicializace repozitáře.
- [x] **Oprava Logování Jídla**: Oddělení jídla od poznámek (nová tabulka `food_logs` + tool `log_food_item`).
- [ ] **Odstranění Lovable závislostí**: Přechod na vlastní API klíče a čistý kód.
- [ ] **Verzování**: Zavedení striktního verzování (package.json).

## 🎨 Fáze 2: UI/UX Refaktoring
- [ ] **Osobnosti**: Přepínač v nastavení pro volbu "Mark" (Technik) vs. "Vera" (Empatie).
- [ ] **Nová Struktura**:
    - Rozdělení karty "Trenér" na "Výkon" (grafy) a "Konektory" (nastavení, importy).
    - Zpřehlednění navigace.

## 🧠 Fáze 3: Pokročilá Inteligence (Cloud Bridge)
- [ ] **Context Awareness**: Asistent si před odpovědí přečte souhrn dat z karty Trenér.
- [ ] **Dlouhodobá Paměť**: Vylepšení `create_summary` pro denní přehledy.
- [ ] **Kalendář & Mail**: Plná integrace nástrojů Google Calendar a Gmail.

## 🏠 Fáze 4: Lokální Mozek (MarkVera Offline)
*Cílový stav: Běh na RPi 5 bez závislosti na cloudu.*
- [ ] **Hardware**: RPi 5 + NVMe SSD + Coral TPU (volitelně).
- [ ] **Lokální LLM**: Ollama (Llama 3 / Mistral) běžící přímo na RPi.
- [ ] **Hlasový Server**: Python backend na RPi nahrazující Supabase Edge Functions.
- [ ] **Voice Client**: Mikrofon + Reproduktor ovládaný lokálně.

## 📦 Backlog vylepšení
- [ ] Vizualizace makroživin (navazuje na opravu jídla).
- [ ] 3D vizualizace svalových skupin.
- [ ] Správa vozového parku (servis, STK).
