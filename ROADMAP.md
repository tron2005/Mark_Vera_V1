# MarkVera Roadmap v1.0.2 🚀

Projekt se transformuje z testovací aplikace na plnohodnotného asistenta M.A.R.K. & V.E.R.A. s cílem běžet lokálně na Raspberry Pi 5.

## 🏆 Fáze 1: Stabilizace a Základy (Hotovo / Probíhá)
- [x] **Separace od Lovable**: Vlastní GitHub repozitář `mark-vera`.
- [x] **UI Refaktoring**: Rozdělení karty Trenér na "Výkon" a "Konektory".
- [x] **Oprava Logování Jídla**: Oddělení jídla od poznámek.
- [ ] **Verzování**: Zavedení striktního verzování (package.json).

## 📊 Fáze 2: Pokročilá Analytika (Runalyze-style) - **CURRENT FOCUS**
- [ ] **Advanced Metrics Widget**:
    - Výpočet TRIMP (Training Impulse).
    - ATL (Únava - 7 dní).
    - CTL (Kondice - 42 dní).
    - TSB (Stress Balance).
    - VO2max odhad.
    - Monotónnost tréninku.
- [ ] **UI Polishing**: Uhlazení vzhledu rozdělené karty Trenér.

## 🧠 Fáze 3: Pokročilá Inteligence (Cloud Bridge)
- [ ] **Context Awareness**: Asistent si před odpovědí přečte souhrn dat z karty Trenér.
- [ ] **Osobnosti**: Přepínač v nastavení pro volbu "Mark" (Technik) vs. "Vera" (Empatie).
- [ ] **Dlouhodobá Paměť**: Vylepšení `create_summary` pro denní přehledy.
- [ ] **Kalendář & Mail**: Plná integrace nástrojů Google Calendar a Gmail.
  - [x] Čtení událostí (dotaz "co mám zítra")
  - [x] Vytváření událostí z chatu
  - [x] Čtení Gmailu (dnes / poslední hodina)
  - [ ] Mazání událostí (podle názvu a data)
  - [ ] Přesun událostí (změna času/dne)
  - [ ] Stabilní souhrny Gmailu (kratší výstupy, bez rate-limit)
  - [ ] Vyhledání událostí podle názvu/časového okna
  - [x] **Web Search**: Vyhledávání aktuálních informací na internetu (Tavily).
  - [ ] **File Workspace**: Pracovní prostor pro soubory (PDF, CSV, obrázky) a jejich analýza.

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
- [ ] Zálohování: stabilní tag + lokální archiv po každé funkční verzi.
