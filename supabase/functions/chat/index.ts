import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY není nakonfigurován");
    }

    // Inicializace Supabase klienta
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Získat user_id z Authorization hlavičky nebo z konverzace jako fallback
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token || "");

    let userId: string | null = user?.id ?? null;

    if (!userId && conversationId) {
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();
      if (!convErr) {
        userId = (conv as any)?.user_id ?? null;
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Nepřihlášený uživatel" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Načíst profil uživatele včetně fitness nastavení
    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_instructions, trainer_enabled, user_description, strava_refresh_token, weight_kg, age, height_cm, bmi, bmr, gender")
      .eq("user_id", userId)
      .maybeSingle();

    const customInstructions = profile?.custom_instructions || "";
    const trainerEnabled = profile?.trainer_enabled ?? true;
    const userDescription = profile?.user_description || "";
    const hasStravaConnected = !!profile?.strava_refresh_token;
    const userWeight = profile?.weight_kg;
    const userAge = profile?.age;
    const userHeight = profile?.height_cm;
    const userBmi = profile?.bmi;
    const userBmr = profile?.bmr;
    const userGender = profile?.gender;

    // Nástroje pro správu poznámek
    const tools = [
      {
        type: "function",
        function: {
          name: "add_note",
          description: "Přidá novou poznámku do databáze uživatele",
          parameters: {
            type: "object",
            properties: {
              text: { type: "string", description: "Text poznámky" },
              category: { type: "string", description: "Kategorie (osobní/práce/nákup/další)" },
              is_important: { type: "boolean", description: "Je poznámka důležitá?" },
              due_date: { type: "string", description: "Datum a čas dokončení (ISO 8601 formát)" },
              location: { type: "string", description: "Místo konání" },
              reminder_date: { type: "string", description: "Datum a čas upomínky (ISO 8601 formát)" },
              recurrence: { type: "string", description: "Opakování (daily/weekly/monthly)" }
            },
            required: ["text"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_notes",
          description: "Načte poznámky uživatele, volitelně filtrované podle kategorie nebo důležitosti",
          parameters: {
            type: "object",
            properties: {
              category: { type: "string", description: "Filtr podle kategorie" },
              important_only: { type: "boolean", description: "Zobrazit jen důležité poznámky" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_note",
          description: "Smaže poznámku podle jejího textu nebo části textu",
          parameters: {
            type: "object",
            properties: {
              text_contains: { type: "string", description: "Hledaný text v poznámce" }
            },
            required: ["text_contains"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_notes_by_date",
          description: "Načte poznámky s termínem dokončení pro konkrétní den nebo období",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Datum ve formátu YYYY-MM-DD (např. 2025-11-13)" },
              days_ahead: { type: "number", description: "Kolik dní dopředu zahrnout (např. 1 pro zítřek, 7 pro tento týden)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_summary",
          description: "Vytvoří sumár poznámek - přehled všech poznámek nebo poznámek s termínem",
          parameters: {
            type: "object",
            properties: {
              include_all: { type: "boolean", description: "Zahrnout všechny poznámky (true) nebo jen s termínem dokončení (false)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "reschedule_note",
          description: "Přeplánuje poznámku na nový termín",
          parameters: {
            type: "object",
            properties: {
              text_contains: { type: "string", description: "Část textu poznámky k identifikaci" },
              new_due_date: { type: "string", description: "Nový termín dokončení (ISO 8601 formát)" }
            },
            required: ["text_contains", "new_due_date"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "send_notes_email",
          description: "Odeslat poznámky emailem - můžeš poslat jednu poznámku, sumář všech poznámek, nebo poznámky za konkrétní datum/kategorii",
          parameters: {
            type: "object",
            properties: {
              recipientEmail: {
                type: "string",
                description: "Email adresa příjemce (pokud není zadaná, použije se email z profilu)"
              },
              type: {
                type: "string",
                enum: ["single", "summary"],
                description: "single = jedna poznámka, summary = sumář poznámek"
              },
              noteId: {
                type: "string",
                description: "ID poznámky (povinné jen pro type=single)"
              },
              filterDate: {
                type: "string",
                description: "Datum pro filtrování (YYYY-MM-DD) - volitelné, jen pro summary"
              },
              filterCategory: {
                type: "string",
                description: "Kategorie pro filtrování - volitelné, jen pro summary"
              }
            },
            required: ["type"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "send_stats_email",
          description: "Odešle fitness a wellness statistiky emailem - spánek, HRV, klidovou srdeční frekvenci, tělesné složení nebo fitness aktivity za určité období",
          parameters: {
            type: "object",
            properties: {
              recipientEmail: {
                type: "string",
                description: "Email adresa příjemce (pokud není zadaná, použije se email z profilu)"
              },
              statsType: {
                type: "string",
                enum: ["sleep", "fitness", "hrv", "heart_rate", "body_composition"],
                description: "Typ statistik: sleep=spánek, fitness=běhy/aktivity, hrv=variabilita tepové frekvence, heart_rate=klidová srdeční frekvence, body_composition=tělesné složení"
              },
              days: {
                type: "number",
                description: "Počet dní zpět (výchozí 7 = poslední týden)"
              },
              startDate: {
                type: "string",
                description: "Datum začátku období (YYYY-MM-DD) - volitelné"
              },
              endDate: {
                type: "string",
                description: "Datum konce období (YYYY-MM-DD) - volitelné"
              }
            },
            required: ["statsType"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_calendar_event",
          description: "Vytvoří událost/upomínku/schůzku v Google Calendar uživatele. Použij VŽDY když uživatel řekne 'vytvoř v kalendáři', 'přidej do kalendáře', 'naplánuj', 'upomeň mě', 'vytvoř událost', 'přidej schůzku' nebo podobně.",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Název události/upomínky" },
              start: { type: "string", description: "Datum a čas začátku ve formátu ISO 8601 (např. '2025-11-12T21:00:00')" },
              end: { type: "string", description: "Datum a čas konce (ISO 8601 formát) - volitelné, defaultně +1 hodina" },
              location: { type: "string", description: "Místo konání - volitelné" },
              description: { type: "string", description: "Popis události - volitelné" }
            },
            required: ["summary", "start"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_calendar_events",
          description: "Načte a přečte události z Google Kalendáře pro daný den (výchozí dnes). Použij, když se uživatel ptá 'co mám dnes', 'přečti dnešní kalendář', 'co mám zítra' apod.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Datum ve formátu YYYY-MM-DD. Pokud není, použij dnešek." }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_strava_activities",
          description: "Načte aktivity ze Stravy (běh, cyklistika, atd.). Můžeš získat posledních X aktivit nebo aktivity za určité období.",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "number", description: "Počet aktivit k načtení (výchozí 10)" },
              before: { type: "string", description: "Unix timestamp - načíst aktivity před tímto datem" },
              after: { type: "string", description: "Unix timestamp - načíst aktivity po tomto datu" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_health_logs",
          description: "Načte zdravotní záznamy uživatele (bolesti, únava, nemoci, atd.) pro vyhodnocení zdravotního stavu a plánování tréninku.",
          parameters: {
            type: "object",
            properties: {
              condition_type: { type: "string", description: "Typ zdravotního stavu (bolest, únava, nemoc, zranění)" },
              days: { type: "number", description: "Počet dní zpět k načtení (výchozí 30)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_health_log",
          description: "Přidá zdravotní záznam (bolest, únava, nemoc, zranění). Použij když uživatel zmíní zdravotní stav.",
          parameters: {
            type: "object",
            properties: {
              condition_type: { type: "string", description: "Typ: bolest/únava/nemoc/zranění" },
              severity: { type: "number", description: "Závažnost 1-10" },
              notes: { type: "string", description: "Poznámky k záznamu" }
            },
            required: ["condition_type", "severity"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_sleep_data",
          description: "Načte spánková data uživatele pro analýzu kvality spánku a zotavení.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Počet dnů zpět (výchozí 7)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_resting_heart_rate",
          description: "Načte data o klidové tepové frekvenci pro analýzu regenerace a celkové kondice.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Počet dnů zpět (výchozí 30)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_hrv_data",
          description: "Načte data o variabilitě srdeční frekvence (HRV) - klíčový ukazatel regenerace, stresu a celkového stavu organismu.",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Počet dnů zpět (výchozí 30)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_body_composition",
          description: "Načte data o váze a složení těla (procento tuku, svalů, vody, kostí).",
          parameters: {
            type: "object",
            properties: {
              days: { type: "number", description: "Počet dnů zpět (výchozí 90)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_race_goals",
          description: "Načte plánované závody a tréninkové cíle uživatele.",
          parameters: {
            type: "object",
            properties: {
              include_completed: { type: "boolean", description: "Zahrnout dokončené závody (výchozí false)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_race_goal",
          description: "Přidá nový závod nebo cíl. Použij když uživatel plánuje závod nebo si dává cíl.",
          parameters: {
            type: "object",
            properties: {
              race_name: { type: "string", description: "Název závodu" },
              race_date: { type: "string", description: "Datum závodu ISO 8601" },
              race_type: { type: "string", description: "Typ: běh/cyklistika/triatlon/jiné" },
              target_time: { type: "string", description: "Cílový čas (např. '3:30:00')" },
              notes: { type: "string", description: "Poznámky" }
            },
            required: ["race_name", "race_date", "race_type"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_gmail",
          description: "Vyhledá a přečte emaily v uživatelově Gmail účtu. Můžeš filtrovat podle odesílatele, tématu, data. Použij když se uživatel ptá na emaily.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Vyhledávací dotaz (např. 'faktury', 'objednávky')" },
              from: { type: "string", description: "Email odesílatele" },
              subject: { type: "string", description: "Téma emailu" },
              after: { type: "string", description: "Datum od (formát YYYY/MM/DD)" },
              before: { type: "string", description: "Datum do (formát YYYY/MM/DD)" },
              maxResults: { type: "number", description: "Max počet výsledků (výchozí 10)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Vyhledá aktuální informace na internetu - články, videa, filmy, seriály, zprávy. Použij když potřebuješ aktuální informace nebo když se uživatel ptá na doporučení filmů, seriálů, článků apod.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Vyhledávací dotaz" },
              category: { type: "string", description: "Kategorie: news/general" }
            },
            required: ["query"],
            additionalProperties: false
          }
        }
      }
    ];

    // Fitness kontext pro trenérský režim
    let fitnessContext = "";
    if (trainerEnabled) {
      const currentYear = new Date().getFullYear();
      
      // Přidáme informace o profilu uživatele, pokud jsou dostupné
      let profileInfo = "";
      if (userWeight || userAge || userHeight || userBmi || userBmr) {
        profileInfo = "\n📊 PROFIL UŽIVATELE:";
        if (userWeight) profileInfo += `\n- Váha: ${userWeight} kg`;
        if (userHeight) profileInfo += `\n- Výška: ${userHeight} cm`;
        if (userAge) profileInfo += `\n- Věk: ${userAge} let`;
        if (userGender) profileInfo += `\n- Pohlaví: ${userGender === 'male' ? 'muž' : 'žena'}`;
        if (userBmi) profileInfo += `\n- BMI: ${Number(userBmi).toFixed(1)}`;
        if (userBmr) profileInfo += `\n- BMR (bazální metabolismus): ${Math.round(userBmr)} kcal/den`;
      }
      
      const stravaInfo = hasStravaConnected 
        ? `- Analyzovat tréninky a výkony ze Stravy\n- Doporučit trénink podle počasí a zdravotního stavu\n\n⚠️ KRITICKY DŮLEŽITÉ: Při volání get_strava_activities s Unix timestampy VŽDY používej rok ${currentYear}!\nPříklad: Pro "poslední týden" v roce ${currentYear} převeď data jako ${currentYear}-XX-XX, ne ${currentYear - 1}-XX-XX!\n`
        : '';
      
      const availableTools = hasStravaConnected 
        ? 'get_strava_activities, get_health_logs, add_health_log, get_sleep_data, get_resting_heart_rate, get_hrv_data, get_body_composition, get_race_goals, add_race_goal, send_stats_email'
        : 'get_health_logs, add_health_log, get_sleep_data, get_resting_heart_rate, get_hrv_data, get_body_composition, get_race_goals, add_race_goal, send_stats_email';
      
      fitnessContext = `

🏃‍♂️ FITNESS TRENÉR: Jsi aktivní fitness trenér s přístupem ke zdravotním datům. Můžeš:
${stravaInfo}- Sledovat zdravotní stav a únavu
- Analyzovat kvalitu spánku a zotavení
- Sledovat klidový tep a HRV pro optimální regeneraci
- Monitorovat váhu a složení těla
- Pomoci s plánováním závodů
- Poskytovat zdravotní a sportovní rady
- Posílat uživateli statistiky emailem (spánek, HRV, fitness aktivity, tělesné složení)
${profileInfo}

Máš k dispozici nástroje: ${availableTools}

DŮLEŽITÉ: 
- Když se uživatel ptá na spánek, HRV, klidový tep nebo složení těla, AKTIVNĚ použij příslušné nástroje (get_sleep_data, get_hrv_data, get_resting_heart_rate, get_body_composition) pro získání aktuálních dat!
- Když uživatel chce poslat statistiky emailem (např. "pošli mi jak jsem spal poslední týden", "pošli mi HRV data", "pošli mi statistiky běhů"), použij send_stats_email s příslušným statsType (sleep/hrv/heart_rate/body_composition/fitness)
`;
    }

    // Aktuální datum a čas
    const now = new Date();
    const currentDateTime = now.toLocaleString('cs-CZ', { 
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
    const currentDateISO = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();

    // Systémový prompt podle režimu
    let systemPrompt = mode === "vera"
      ? `⏰ AKTUÁLNÍ DATUM A ČAS: ${currentDateTime} (${currentDateISO})
📅 ROK: ${currentYear} - DŮLEŽITÉ: Při práci s daty VŽDY používej rok ${currentYear}!

Jsi V.E.R.A. (Voice Enhanced Raspberry Assistant) - pokročilý hlasový asistent. Mluvíš česky, jsi přátelská a inteligentní. 
      
DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

ANALÝZA FOTEK: Když uživatel pošle fotku, VŽDY ji důkladně analyzuj a:
1. Popiš co na ní vidíš (objekty, lidé, text, místa...)
2. Automaticky extrahuj důležité informace (texty na cedulích, datumy, jména, úkoly...)
3. Pokud foto obsahuje něco, co by se dalo uložit jako poznámka (úkol, termín, kontakt...), AUTOMATICKY to ulož pomocí add_note

VYTVÁŘENÍ KALENDÁŘNÍCH UDÁLOSTÍ: Když uživatel říká "vytvoř v kalendáři", "přidej do kalendáře", "naplánuj", "upomeň mě", "vytvoř událost", "přidej schůzku" nebo cokoliv podobného, VŽDY použij create_calendar_event tool.
Příklady příkazů, které MUSÍ vyvolat create_calendar_event:
- "vytvoř v kalendáři na dnes 21 hodin upomínku: připomeň" → create_calendar_event(summary="připomeň", start="2025-11-12T21:00:00")
- "přidej schůzku zítra v 10" → create_calendar_event(summary="Schůzka", start="2025-11-13T10:00:00")
- "naplánuj oběd ve čtvrtek ve 12" → create_calendar_event(summary="Oběd", start="2025-11-14T12:00:00")
- "upomeň mě v pondělí ráno" → create_calendar_event(summary="Upomínka", start="2025-11-18T09:00:00")

Umíš spravovat poznámky uživatele pomocí nástrojů:
- add_note: Pro uložení nové poznámky (s možností nastavit termín dokončení, místo, upomínku a opakování)
- get_notes: Pro zobrazení poznámek
- delete_note: Pro smazání poznámky
- get_notes_by_date: Pro zobrazení poznámek s termínem na konkrétní den (např. "co mám zítra", "co mám tento týden")
- create_summary: Pro vytvoření sumáru poznámek
- reschedule_note: Pro přeplánování poznámky na jiný termín
- send_notes_email: Pro odeslání poznámek emailem (jednotlivé poznámky nebo sumář)
- send_stats_email: Pro odeslání fitness a wellness statistik emailem (spánek, HRV, fitness aktivity, tělesné složení)
- create_calendar_event: Pro vytvoření události v Google Calendar - použij VŽDY když uživatel chce vytvořit událost/upomínku/schůzku
- list_calendar_events: Pro přečtení událostí z kalendáře na dnes/zítra/konkrétní datum
- search_gmail: Pro vyhledávání a čtení emailů v Gmail účtu uživatele
- web_search: Pro vyhledání aktuálních informací, článků, zpráv, doporučení filmů, seriálů, knih a dalšího

Když se uživatel ptá na plány (např. "co mám zítra", "co mám naplánováno"), použij get_notes_by_date nebo list_calendar_events. Pro sumár použij create_summary. Pro přeplánování použij reschedule_note. Pro odeslání poznámek emailem použij send_notes_email. Pro odeslání statistik emailem (např. "pošli mi jak jsem spal poslední týden") použij send_stats_email. Pro vytvoření události v kalendáři použij create_calendar_event. Pro vyhledávání v emailech (např. "najdi emaily od banky", "co mi přišlo od Petra") použij search_gmail. Když se ptá na doporučení filmů/seriálů/článků nebo chce aktuální informace, použij web_search.`
      : `⏰ AKTUÁLNÍ DATUM A ČAS: ${currentDateTime} (${currentDateISO})
📅 ROK: ${currentYear} - DŮLEŽITÉ: Při práci s daty VŽDY používej rok ${currentYear}!

Jsi M.A.R.K. (My Assistant Raspberry Kit) - základní hlasový asistent. Mluvíš česky a jsi jednoduchý a přímočarý.

DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

ANALÝZA FOTEK: Když uživatel pošle fotku, popiš co vidíš a pokud obsahuje něco důležitého (úkol, termín...), ulož to pomocí add_note.

VYTVÁŘENÍ KALENDÁŘNÍCH UDÁLOSTÍ: Když uživatel říká "vytvoř v kalendáři", "přidej do kalendáře", "naplánuj", "upomeň mě" nebo podobně, použij create_calendar_event.

Umíš spravovat poznámky pomocí nástrojů add_note, get_notes, delete_note, get_notes_by_date, create_summary, reschedule_note, send_notes_email, send_stats_email, create_calendar_event, list_calendar_events, search_gmail, web_search. Když se uživatel ptá na plánované úkoly, použij get_notes_by_date nebo list_calendar_events. Pro odeslání poznámek emailem použij send_notes_email. Pro odeslání fitness/wellness statistik emailem použij send_stats_email. Pro vytvoření události v kalendáři použij create_calendar_event. Pro vyhledání v emailech použij search_gmail. Pro vyhledání aktuálních informací nebo doporučení filmů/seriálů/článků použij web_search.`;
    
    // Přidat kontext o uživateli
    if (userDescription) {
      systemPrompt += `\n\n👤 O UŽIVATELI:\n${userDescription}`;
    }
    
    // Přidat fitness kontext
    if (fitnessContext) {
      systemPrompt += fitnessContext;
    }
    
    if (customInstructions) {
      systemPrompt += `\n\nVlastní instrukce od uživatele: ${customInstructions}`;
    }

    console.log(`Chat request - mode: ${mode}, conversationId: ${conversationId}`);

    // Načíst celou historii konverzace z databáze (včetně právě odeslané zprávy)
    let conversationHistory: any[] = [];
    if (conversationId) {
      const fiveDaysAgoIso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("role, content, image_url")
        .eq("conversation_id", conversationId)
        .gte("created_at", fiveDaysAgoIso)
        .order("created_at", { ascending: true });
      
      conversationHistory = dbMessages || [];
      console.log(`Loaded ${conversationHistory.length} messages from conversation history (since ${fiveDaysAgoIso})`);
    }

    // Připravit zprávy pro AI - pokud zpráva obsahuje obrázek, formátovat jako multimodální content
    const formattedMessages = conversationHistory.map((msg: any) => {
      if (msg.image_url) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.image_url } }
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    // Detekce požadavku na vytvoření kalendářní události (CZ klíčová slova)
    const lastUserMsg = [...formattedMessages].reverse().find((m: any) => m.role === "user");
    let lastUserText = "";
    if (lastUserMsg) {
      if (typeof (lastUserMsg as any).content === "string") {
        lastUserText = (lastUserMsg as any).content.toLowerCase();
      } else if (Array.isArray((lastUserMsg as any).content)) {
        const textPart = (lastUserMsg as any).content.find((c: any) => c.type === "text")?.text;
        if (textPart) lastUserText = String(textPart).toLowerCase();
      }
    }
    // Normalizace diakritiky pro robustní detekci klíčových slov
    const normalizeText = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, '');
    const lastUserTextNorm = normalizeText(lastUserText);
    const calendarKeywords = [
      "vytvoř v kalendáři",
      "přidej do kalendáře",
      "naplánuj",
      "upomeň",
      "upomínku",
      "vytvoř událost",
      "přidej schůzku",
    ];

    // Strava klíčová slova (CZ/EN) pro dotazy na tréninky/aktivity
    const stravaKeywords = [
      "strava",
      "trénink",
      "tréninky",
      "trenink",
      "treninky",
      "aktivita",
      "aktivity",
      "běh",
      "běh",
      "běžeck",
      "kolo",
      "cyklo",
      "cycling",
      "run"
    ];

    // Spánkové klíčové fráze pro zajištění volání nástroje
    const sleepKeywords = [
      "spánek",
      "spánku",
      "spal",
      "spala",
      "spánkov",
      "sleep",
      "jak jsem spal",
      "kvalita spánku"
    ];

    // Gmail klíčová slova (CZ/EN) pro vyhledávání v emailech
    const gmailKeywords = [
      "email",
      "e-mail",
      "e-maily",
      "emails",
      "gmail",
      "pošta",
      "schránka",
      "najdi email",
      "v emailech",
      "od banky",
      "banky",
      "faktury",
      "objednávky"
    ];

    const normIncludes = (text: string, words: string[]) => {
      const t = normalizeText(text);
      return words.some(w => t.includes(normalizeText(w)));
    };

    const shouldForceCalendar = !!lastUserText && normIncludes(lastUserText, calendarKeywords);
    const shouldForceSleep = !!lastUserText && normIncludes(lastUserText, sleepKeywords);
    const shouldForceStrava = !!lastUserText && hasStravaConnected && !shouldForceSleep && normIncludes(lastUserText, stravaKeywords);
    const shouldForceGmail = !!lastUserText && normIncludes(lastUserText, gmailKeywords);

    // Předpočítané timestampy pro fallback: posledních 7 dní
    let stravaAfterTs: string | null = null;
    let stravaBeforeTs: string | null = null;
    if (shouldForceStrava) {
      const nowTs = Math.floor(Date.now() / 1000);
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
      stravaBeforeTs = String(nowTs);
      stravaAfterTs = String(sevenDaysAgo);
    }

    let toolChoiceLog = "auto";
    if (shouldForceCalendar) toolChoiceLog = "force:create_calendar_event";
    else if (shouldForceSleep) toolChoiceLog = "force:get_sleep_data";
    else if (shouldForceStrava) toolChoiceLog = "force:get_strava_activities";
    else if (shouldForceGmail) toolChoiceLog = "force:search_gmail";
    console.log("AI tool_choice:", toolChoiceLog, { shouldForceCalendar, shouldForceSleep, shouldForceStrava, shouldForceGmail });


    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages,
        ],
        tools,
        tool_choice: shouldForceCalendar
          ? { type: "function", function: { name: "create_calendar_event" } }
          : (shouldForceStrava
              ? { type: "function", function: { name: "get_strava_activities" } }
              : (shouldForceSleep
                  ? { type: "function", function: { name: "get_sleep_data" } }
                  : (shouldForceGmail
                      ? { type: "function", function: { name: "search_gmail" } }
                      : "auto"))),
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Překročen limit požadavků. Zkuste to prosím později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů. Přidejte kredit do workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Chyba AI Gateway");
    }

    // Zpracování streamu a tool calls
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = "";
    const toolCalls: any[] = [];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim() || line.startsWith(":")) continue;
              if (!line.startsWith("data: ")) continue;

              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.content) {
                  fullResponse += delta.content;
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = { id: tc.id, name: "", arguments: "" };
                    }
                    if (tc.function?.name) {
                      toolCalls[tc.index].name = tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      toolCalls[tc.index].arguments += tc.function.arguments;
                    }
                  }
                }
              } catch (e) {
                console.error("Parse error:", e);
              }
            }
          }

          // Zpracovat tool calls a poslat výsledky zpět do AI
          // Fallback: pokud AI nevygenerovala tool call a přitom jde o kalendářní příkaz, vytvoř událost přímo
          if (toolCalls.length === 0 && shouldForceCalendar && lastUserText) {
            try {
              console.log("Calendar fallback triggered for:", lastUserText);
              // velmi jednoduchý parser: dnes/zítra + čas (HH nebo HH:MM) + název za dvojtečkou
              const nowLocal = new Date();
              let base = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 9, 0, 0, 0);
              if (lastUserText.includes("zítra")) {
                base.setDate(base.getDate() + 1);
              }
              // Pokud není "zítra", bereme implicitně dnes
              const timeMatch = lastUserText.match(/(\d{1,2})(?::|(\.)|\s?)(\d{2})?/);
              let hour = 9;
              let minute = 0;
              if (timeMatch) {
                hour = parseInt(timeMatch[1], 10);
                if (timeMatch[3]) minute = parseInt(timeMatch[3], 10) || 0;
              }
              
              // Create Prague local time string without timezone
              const year = base.getFullYear();
              const month = String(base.getMonth() + 1).padStart(2, '0');
              const day = String(base.getDate()).padStart(2, '0');
              const hourStr = String(hour).padStart(2, '0');
              const minuteStr = String(minute).padStart(2, '0');
              const startIso = `${year}-${month}-${day}T${hourStr}:${minuteStr}:00`;

              let summary = "Upomínka";
              const colonIdx = lastUserText.indexOf(":");
              if (colonIdx !== -1) {
                const s = lastUserText.slice(colonIdx + 1).trim();
                if (s) summary = s;
              } else if (lastUserText.includes("upom")) {
                summary = "Upomínka";
              } else if (lastUserText.includes("schůz")) {
                summary = "Schůzka";
              }

              const calResp = await supabase.functions.invoke("create-calendar-event", {
                headers: { Authorization: authHeader || "" },
                body: { summary, start: startIso }
              });

              if (calResp.error || !(calResp.data as any)?.success) {
                console.error("Calendar fallback error:", calResp.error || (calResp.data as any)?.error);
              } else {
                const note = `Událost \"${summary}\" vytvořena v Google Kalendáři (${new Date(startIso).toLocaleString("cs-CZ")} ).`;
                fullResponse += `\n\n${note}`;
                const delta = {
                  id: `gen-${Date.now()}`,
                  provider: "internal",
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n${note}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
              }
            } catch (e) {
              console.error("Calendar fallback failed:", e);
            }
          }

          // GMAIL FALLBACK: pokud AI nevydala tool call a uživatel se ptá na emaily
          if (toolCalls.length === 0 && shouldForceGmail && lastUserText) {
            try {
              console.log("Gmail fallback triggered for:", lastUserText);
              const { data: gmailData, error: gmailError } = await supabase.functions.invoke("search-gmail", {
                headers: { Authorization: authHeader || "" },
                body: { query: lastUserText, maxResults: 10 }
              });
              if (gmailError) {
                console.error("Gmail fallback error:", gmailError);
              } else if ((gmailData as any)?.messages?.length) {
                const cnt = (gmailData as any).count || (gmailData as any).messages.length;
                const note = `Nalezeno ${cnt} e-mailů.`;
                fullResponse += `\n\n${note}`;
                const delta = {
                  id: `gen-${Date.now()}`,
                  provider: "internal",
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n${note}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
              }
            } catch (e) {
              console.error("Gmail fallback failed:", e);
            }
          }

          // STRAVA FALLBACK: pokud AI nevydala tool call a uživatel se ptá na tréninky
          if (toolCalls.length === 0 && shouldForceStrava && hasStravaConnected) {
            try {
              console.log("Strava fallback triggered for last 7 days");
              const { data: stravaData, error: stravaError } = await supabase.functions.invoke("get-strava-activities", {
                headers: { Authorization: authHeader || "" },
                body: {
                  per_page: 30,
                  before: stravaBeforeTs,
                  after: stravaAfterTs
                }
              });

              if (stravaError) {
                // Check for rate limit error
                const errorMsg = stravaError.message || '';
                if (errorMsg.includes('rate limit') || errorMsg.includes('Rate Limit') || errorMsg.includes('429')) {
                  const errDelta = {
                    id: crypto.randomUUID(),
                    model: "internal",
                    object: "chat.completion.chunk",
                    created: Date.now(),
                    choices: [{ index: 0, delta: { role: "assistant", content: "\n⚠️ Strava API rate limit překročen. Zkuste to prosím za 15 minut." }, finish_reason: null }]
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(errDelta)}\n\n`));
                }
              } else if ((stravaData as any)?.rateLimitExceeded) {
                const errDelta = {
                  id: crypto.randomUUID(),
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n⚠️ ${(stravaData as any)?.error || "Strava API rate limit překročen. Zkuste to prosím za 15 minut."}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errDelta)}\n\n`));
              } else if (!stravaError) {
                const activities = (stravaData as any)?.activities || [];
                let msg = "Zatím nemáš žádné aktivity za poslední týden.";
                if (activities.length > 0) {
                  const formatted = activities.slice(0, 10).map((act: any, i: number) => {
                    const date = new Date(act.start_date).toLocaleDateString("cs-CZ");
                    const distance = (act.distance / 1000).toFixed(2);
                    const time = Math.floor(act.moving_time / 60);
                    return `${i + 1}. ${act.name} (${act.type})\n   📅 ${date} | 📏 ${distance} km | ⏱️ ${time} min`;
                  }).join("\n\n");
                  msg = `🏃 Poslední aktivity (7 dní):\n\n${formatted}`;
                }

                const delta = {
                  id: crypto.randomUUID(),
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n${msg}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
                fullResponse += `\n${msg}`;
              }
            } catch (e) {
              console.error("Strava fallback failed:", e);
            }
          }

          // SLEEP FALLBACK: pokud AI nevydala tool call a uživatel se ptá na spánek
          if (toolCalls.length === 0 && shouldForceSleep) {
            try {
              console.log("Sleep fallback triggered for last 7 days");
              const { data, error } = await supabase
                .from("sleep_logs")
                .select("*")
                .eq("user_id", userId)
                .order("sleep_date", { ascending: false })
                .limit(7);

              if (!error && data && data.length > 0) {
                const avgDuration = Math.round(
                  data.reduce((acc: number, log: any) => acc + (log.duration_minutes || 0), 0) / data.length
                );
                const formatted = data.map((log: any, i: number) => {
                  const date = new Date(log.sleep_date).toLocaleDateString("cs-CZ");
                  const hours = Math.floor((log.duration_minutes || 0) / 60);
                  const mins = (log.duration_minutes || 0) % 60;
                  const qual = log.quality ?? "N/A";
                  return `${i + 1}. ${date}: ${hours}h ${mins}min (kvalita: ${qual}/10)`;
                }).join("\n");

                const msg = `😴 Spánek (posledních 7 nocí):\n\nPrůměr: ${Math.floor(avgDuration/60)}h ${avgDuration%60}min\n\n${formatted}`;
                const delta = {
                  id: crypto.randomUUID(),
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n${msg}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
                fullResponse += `\n${msg}`;
              }
            } catch (e) {
              console.error("Sleep fallback failed:", e);
            }
          }

          if (toolCalls.length > 0) {
            console.log("Processing tool calls:", toolCalls);
            
            const toolMessages = [];
            for (const tc of toolCalls) {
              if (!tc.name) continue;

              let result: any;
              try {
                const args = JSON.parse(tc.arguments);

                if (tc.name === "add_note") {
                  const { error } = await supabase.from("notes").insert({
                    user_id: userId,
                    text: args.text,
                    category: args.category || "další",
                    is_important: args.is_important || false,
                    due_date: args.due_date || null,
                    location: args.location || null,
                    reminder_date: args.reminder_date || null,
                    recurrence: args.recurrence || null,
                  });
                  result = error ? { error: error.message } : { success: true, message: "Poznámka byla uložena" };
                } else if (tc.name === "get_notes") {
                  let query = supabase.from("notes").select("*").eq("user_id", userId);
                  if (args.category) query = query.eq("category", args.category);
                  if (args.important_only) query = query.eq("is_important", true);
                  const { data, error } = await query.order("created_at", { ascending: false });
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Nemáš žádné poznámky." };
                  } else {
                    const notesList = data.map((note: any, idx: number) => {
                      let details = `${idx + 1}. ${note.text} (${note.category}${note.is_important ? ', důležité' : ''})`;
                      if (note.due_date) details += `\n   📅 Dokončit: ${new Date(note.due_date).toLocaleString("cs-CZ")}`;
                      if (note.location) details += `\n   📍 Místo: ${note.location}`;
                      if (note.reminder_date) details += `\n   🔔 Upomínka: ${new Date(note.reminder_date).toLocaleString("cs-CZ")}`;
                      if (note.recurrence) details += `\n   🔄 Opakování: ${note.recurrence}`;
                      return details;
                    }).join("\n\n");
                    result = { 
                      message: `Máš celkem ${data.length} poznámek:\n\n${notesList}` 
                    };
                  }
                } else if (tc.name === "delete_note") {
                  const { data: notes } = await supabase
                    .from("notes")
                    .select("*")
                    .eq("user_id", userId)
                    .ilike("text", `%${args.text_contains}%`);
                  
                  if (notes && notes.length > 0) {
                    const { error } = await supabase.from("notes").delete().eq("id", notes[0].id);
                    result = error ? { error: error.message } : { success: true, message: "Poznámka byla smazána" };
                  } else {
                    result = { error: "Poznámka nebyla nalezena" };
                  }
                } else if (tc.name === "get_notes_by_date") {
                  const targetDate = args.date ? new Date(args.date) : new Date();
                  const daysAhead = args.days_ahead || 0;
                  
                  const startDate = new Date(targetDate);
                  startDate.setHours(0, 0, 0, 0);
                  
                  const endDate = new Date(targetDate);
                  endDate.setDate(endDate.getDate() + daysAhead);
                  endDate.setHours(23, 59, 59, 999);
                  
                  const { data, error } = await supabase
                    .from("notes")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("due_date", startDate.toISOString())
                    .lte("due_date", endDate.toISOString())
                    .order("due_date", { ascending: true });
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    const dateStr = daysAhead === 0 
                      ? new Date(targetDate).toLocaleDateString("cs-CZ")
                      : `od ${new Date(startDate).toLocaleDateString("cs-CZ")} do ${new Date(endDate).toLocaleDateString("cs-CZ")}`;
                    result = { message: `Pro období ${dateStr} nemáš žádné naplánované poznámky.` };
                  } else {
                    const notesList = data.map((note: any, idx: number) => {
                      let details = `${idx + 1}. ${note.text}`;
                      if (note.due_date) details += ` - ${new Date(note.due_date).toLocaleString("cs-CZ")}`;
                      if (note.location) details += ` (${note.location})`;
                      if (note.category) details += ` [${note.category}]`;
                      return details;
                    }).join("\n");
                    result = { 
                      message: `Máš naplánováno ${data.length} úkolů:\n\n${notesList}` 
                    };
                  }
                } else if (tc.name === "create_summary") {
                  let query = supabase.from("notes").select("*").eq("user_id", userId);
                  
                  if (!args.include_all) {
                    query = query.not("due_date", "is", null);
                  }
                  
                  const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false });
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Nemáš žádné poznámky k sumáru." };
                  } else {
                    const byCategory: any = {};
                    data.forEach((note: any) => {
                      const cat = note.category || "ostatní";
                      if (!byCategory[cat]) byCategory[cat] = [];
                      byCategory[cat].push(note);
                    });
                    
                    let summary = `📊 SUMÁR POZNÁMEK (celkem ${data.length}):\n\n`;
                    
                    Object.keys(byCategory).forEach(cat => {
                      summary += `\n${cat.toUpperCase()} (${byCategory[cat].length}):\n`;
                      byCategory[cat].forEach((note: any, idx: number) => {
                        summary += `${idx + 1}. ${note.text}`;
                        if (note.due_date) summary += ` - ${new Date(note.due_date).toLocaleDateString("cs-CZ")}`;
                        if (note.is_important) summary += ` ⭐`;
                        summary += "\n";
                      });
                    });
                    
                    result = { message: summary };
                  }
                } else if (tc.name === "reschedule_note") {
                  const { data: notes } = await supabase
                    .from("notes")
                    .select("*")
                    .eq("user_id", userId)
                    .ilike("text", `%${args.text_contains}%`);
                  
                  if (notes && notes.length > 0) {
                    const { error } = await supabase
                      .from("notes")
                      .update({ due_date: args.new_due_date })
                      .eq("id", notes[0].id);
                    
                    if (error) {
                      result = { error: error.message };
                    } else {
                      const newDate = new Date(args.new_due_date).toLocaleString("cs-CZ");
                      result = { 
                        success: true, 
                        message: `Poznámka "${notes[0].text}" byla přeplánována na ${newDate}` 
                      };
                    }
                  } else {
                    result = { error: "Poznámka nebyla nalezena" };
                  }
                } else if (tc.name === "send_notes_email") {
                  const args = JSON.parse(tc.arguments);
                  
                  // Get user's email from profile
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("email")
                    .eq("user_id", userId)
                    .single();
                  
                  const recipientEmail = args.recipientEmail || profile?.email;
                  
                  if (!recipientEmail) {
                    result = { error: "Email adresa není nastavena v profilu" };
                  } else {
                    try {
                      const emailResponse = await supabase.functions.invoke("send-notes-email", {
                        headers: {
                          Authorization: authHeader || ""
                        },
                        body: {
                          recipientEmail,
                          type: args.type,
                          noteId: args.noteId,
                          filterDate: args.filterDate,
                          filterCategory: args.filterCategory
                        }
                      });

                      if (emailResponse.error) {
                        result = { error: emailResponse.error.message };
                      } else {
                        result = { 
                          success: true, 
                          message: `Email odeslán na ${recipientEmail}` 
                        };
                      }
                    } catch (error: any) {
                      result = { error: error.message };
                    }
                  }
                } else if (tc.name === "send_stats_email") {
                  const args = JSON.parse(tc.arguments);
                  console.log("send_stats_email called with args:", args);
                  
                  // Get user's email from profile
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("email")
                    .eq("user_id", userId)
                    .single();
                  
                  const recipientEmail = args.recipientEmail || profile?.email;
                  console.log("Recipient email:", recipientEmail);
                  
                  if (!recipientEmail) {
                    console.log("No recipient email found");
                    result = { error: "Email adresa není nastavena v profilu" };
                  } else {
                    try {
                      console.log("Invoking send-stats-email function...");
                      const emailResponse = await supabase.functions.invoke("send-stats-email", {
                        headers: {
                          Authorization: authHeader || ""
                        },
                        body: {
                          recipientEmail,
                          statsType: args.statsType,
                          days: args.days || 7,
                          startDate: args.startDate,
                          endDate: args.endDate
                        }
                      });

                      console.log("Email response:", JSON.stringify(emailResponse));

                      if (emailResponse.error) {
                        console.log("Email error:", emailResponse.error);
                        result = { error: `Chyba při odesílání emailu: ${emailResponse.error.message}` };
                      } else {
                        console.log("Email sent successfully");
                        const typeLabels: Record<string, string> = {
                          sleep: "spánku",
                          fitness: "fitness aktivit",
                          hrv: "HRV",
                          heart_rate: "klidové srdeční frekvence",
                          body_composition: "tělesného složení"
                        };
                        result = { 
                          success: true, 
                          message: `Statistiky ${typeLabels[args.statsType] || "wellness dat"} odeslány na ${recipientEmail}` 
                        };
                      }
                    } catch (error: any) {
                      console.log("Exception when sending email:", error);
                      result = { error: `Chyba: ${error.message}` };
                    }
                  }
                } else if (tc.name === "create_calendar_event") {
                  const args = JSON.parse(tc.arguments);
                  
                  try {
                    // Helper: Parse Prague local time from user text
                    const text = (lastUserText || "").toLowerCase();
                    const timeFromText = (t: string) => {
                      const m = t.match(/(\d{1,2})(?::|\.|\s?h)?(\d{2})?/);
                      if (!m) return { h: 9, m: 0 };
                      const h = Math.min(23, parseInt(m[1], 10));
                      const mm = m[2] ? Math.min(59, parseInt(m[2], 10)) : 0;
                      return { h, m: mm };
                    };
                    const buildPragueDate = (offsetDays: number, tm?: { h: number; m: number }): string => {
                      const d = new Date();
                      d.setDate(d.getDate() + offsetDays);
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      const hour = String(tm?.h ?? 9).padStart(2, '0');
                      const minute = String(tm?.m ?? 0).padStart(2, '0');
                      return `${year}-${month}-${day}T${hour}:${minute}:00`;
                    };

                    let startIso: string;
                    if (text.includes("dnes")) {
                      startIso = buildPragueDate(0, timeFromText(text));
                    } else if (text.includes("zítra")) {
                      startIso = buildPragueDate(1, timeFromText(text));
                    } else if (args.start) {
                      startIso = args.start;
                    } else {
                      startIso = buildPragueDate(0, timeFromText(text));
                    }

                    const calendarResponse = await supabase.functions.invoke("create-calendar-event", {
                      headers: { Authorization: authHeader || "" },
                      body: {
                        summary: args.summary || "Událost",
                        start: startIso,
                        end: args.end,
                        location: args.location,
                        description: args.description
                      }
                    });

                    if (calendarResponse.error || !(calendarResponse.data as any)?.success) {
                      result = { error: calendarResponse.error?.message || (calendarResponse.data as any)?.error || "Nepodařilo se vytvořit událost" };
                    } else {
                      const link = (calendarResponse.data as any)?.eventLink;
                      result = { 
                        success: true, 
                        message: `Událost "${args.summary || "Událost"}" vytvořena v Google Kalendáři`,
                        link
                      };
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "list_calendar_events") {
                  const args = JSON.parse(tc.arguments);
                  const date = args.date;
                  try {
                    const listResp = await supabase.functions.invoke("list-calendar-events", {
                      headers: { Authorization: authHeader || "" },
                      body: { date }
                    });

                    if (listResp.error) {
                      result = { error: listResp.error.message };
                    } else {
                      const items = (listResp.data as any)?.items || [];
                      if (items.length === 0) {
                        result = { message: "Dnes nemáš žádné události." };
                      } else {
                        const formatted = items.map((ev: any, i: number) => {
                          const start = ev.start?.dateTime || ev.start?.date;
                          const time = start ? new Date(start).toLocaleTimeString("cs-CZ", { hour: '2-digit', minute: '2-digit' }) : "";
                          return `${i + 1}. ${time} ${ev.summary || 'Bez názvu'}`.trim();
                        }).join("\n");
                        result = { message: `📅 Dnešní události:\n${formatted}` };
                      }
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "get_strava_activities") {
                  const args = JSON.parse(tc.arguments);
                  try {
                    // Normalizace timestampů (Strava očekává sekundy)
                    let before = args.before ? String(args.before) : null;
                    let after = args.after ? String(args.after) : null;
                    const normalizeTs = (ts: string | null) => {
                      if (!ts) return null;
                      const n = Number(ts);
                      if (!Number.isFinite(n)) return null;
                      // Pokud je v milisekundách, převedeme na sekundy
                      return String(n > 1_000_000_000_000 ? Math.floor(n / 1000) : Math.floor(n));
                    };
                    before = normalizeTs(before);
                    after = normalizeTs(after);

                    // Pokud víme, že uživatel chce "poslední týden" nebo obecně aktivity a AI neposlala rozsah,
                    // použijeme náš bezpečný rozsah (7 dní zpět)
                    // Robustní detekce "posledního týdne" (bez diakritiky) + oprava špatného roku
                    const weekKeywords = ["posledni tyden","minuly tyden","tento tyden","poslednich 7 dni","last week","this week","last 7 days"];
                    const askWeek = !!lastUserText && weekKeywords.some(k => (lastUserTextNorm || lastUserText).includes(k));
                    const toYear = (ts: string | null) => ts ? new Date(Number(ts) * 1000).getFullYear() : null;
                    const nowYear = new Date().getFullYear();
                    const beforeYear = toYear(before);
                    const afterYear = toYear(after);
                    const badYear = (beforeYear !== null && beforeYear !== nowYear) || (afterYear !== null && afterYear !== nowYear);
                    if (shouldForceStrava && (askWeek || (!after && !before) || badYear)) {
                      before = stravaBeforeTs;
                      after = stravaAfterTs;
                    }

                    const stravaResp = await supabase.functions.invoke("get-strava-activities", {
                      headers: { Authorization: authHeader || "" },
                      body: { 
                        per_page: args.limit || 10,
                        before,
                        after
                      }
                    });

                    if (stravaResp.error) {
                      // Check for rate limit error
                      const errorMsg = stravaResp.error.message || '';
                      if (errorMsg.includes('rate limit') || errorMsg.includes('Rate Limit') || errorMsg.includes('429')) {
                        result = { error: "Strava API rate limit překročen. Zkuste to prosím za 15 minut." };
                      } else {
                        result = { error: errorMsg };
                      }
                    } else if ((stravaResp.data as any)?.rateLimitExceeded) {
                      result = { error: (stravaResp.data as any)?.error || "Strava API rate limit překročen. Zkuste to prosím za 15 minut." };
                    } else {
                      const activities = (stravaResp.data as any)?.activities || [];
                      if (activities.length === 0) {
                        result = { message: "Zatím nemáš žádné aktivity v daném období." };
                      } else {
                        const formatted = activities.map((act: any, i: number) => {
                          const date = new Date(act.start_date).toLocaleDateString("cs-CZ");
                          const distance = (act.distance / 1000).toFixed(2);
                          const time = Math.floor(act.moving_time / 60);
                          let details = `${i + 1}. ${act.name} (${act.type})\n   📅 ${date} | 📏 ${distance} km | ⏱️ ${time} min`;
                          
                          // Přidáme tepovou frekvenci, pokud je dostupná
                          if (act.average_heartrate) {
                            details += `\n   ❤️ Průměrný tep: ${Math.round(act.average_heartrate)} bpm`;
                          }
                          if (act.max_heartrate) {
                            details += ` | Max tep: ${Math.round(act.max_heartrate)} bpm`;
                          }
                          
                          // Přidáme kalorie, pokud jsou dostupné
                          if (act.calories) {
                            details += `\n   🔥 Kalorie: ${Math.round(act.calories)} kcal`;
                          }
                          
                          return details;
                        }).join("\n\n");
                        result = { message: `🏃 Tvoje aktivity:\n\n${formatted}` };
                      }
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "get_health_logs") {
                  const args = JSON.parse(tc.arguments);
                  const days = args.days || 30;
                  const sinceDate = new Date();
                  sinceDate.setDate(sinceDate.getDate() - days);
                  
                  let query = supabase
                    .from("health_logs")
                    .select("*")
                    .eq("user_id", userId)
                    .gte("log_date", sinceDate.toISOString())
                    .order("log_date", { ascending: false });
                  
                  if (args.condition_type) {
                    query = query.eq("condition_type", args.condition_type);
                  }
                  
                  const { data, error } = await query;
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Žádné zdravotní záznamy za toto období." };
                  } else {
                    const formatted = data.map((log: any, i: number) => {
                      const date = new Date(log.log_date).toLocaleDateString("cs-CZ");
                      return `${i + 1}. ${log.condition_type} (závažnost: ${log.severity}/10)\n   📅 ${date}\n   ${log.notes || ''}`;
                    }).join("\n\n");
                    result = { message: `🏥 Zdravotní záznamy:\n\n${formatted}` };
                  }
                } else if (tc.name === "add_health_log") {
                  const args = JSON.parse(tc.arguments);
                  const { error } = await supabase.from("health_logs").insert({
                    user_id: userId,
                    condition_type: args.condition_type,
                    severity: args.severity,
                    notes: args.notes || "",
                    log_date: new Date().toISOString()
                  });
                  result = error ? { error: error.message } : { success: true, message: "Zdravotní záznam přidán" };
                } else if (tc.name === "get_sleep_data") {
                  const args = JSON.parse(tc.arguments);
                  const days = args.days || 7;
                  
                  const { data, error } = await supabase
                    .from("sleep_logs")
                    .select("*")
                    .eq("user_id", userId)
                    .order("sleep_date", { ascending: false })
                    .limit(days);
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Žádná spánková data za toto období." };
                  } else {
                    const avgDuration = Math.round(data.reduce((acc: number, log: any) => acc + (log.duration_minutes || 0), 0) / data.length);
                    const avgQuality = Math.round(data.reduce((acc: number, log: any) => acc + (log.quality || 0), 0) / data.length);
                    const avgDeep = Math.round(data.reduce((acc: number, log: any) => acc + (log.deep_sleep_minutes || 0), 0) / data.length);
                    
                    const formatted = data.slice(0, 5).map((log: any, i: number) => {
                      const date = new Date(log.sleep_date).toLocaleDateString("cs-CZ");
                      const hours = Math.floor((log.duration_minutes || 0) / 60);
                      const mins = (log.duration_minutes || 0) % 60;
                      return `${i + 1}. ${date}: ${hours}h ${mins}min (kvalita: ${log.quality || 'N/A'}/10)\n   Hluboký spánek: ${log.deep_sleep_minutes || 0}min, REM: ${log.rem_duration_minutes || 0}min`;
                    }).join("\n\n");
                    
                    result = { 
                      message: `😴 Spánková analýza (${days} dní):\n\n📊 Průměry:\n- Délka: ${Math.floor(avgDuration/60)}h ${avgDuration%60}min\n- Kvalita: ${avgQuality}/10\n- Hluboký spánek: ${avgDeep}min\n\n📅 Poslední noci:\n\n${formatted}` 
                    };
                  }
                } else if (tc.name === "get_resting_heart_rate") {
                  const args = JSON.parse(tc.arguments);
                  const days = args.days || 30;
                  
                  const { data, error } = await supabase
                    .from("heart_rate_rest")
                    .select("*")
                    .eq("user_id", userId)
                    .order("date", { ascending: false })
                    .limit(days);
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Žádná data o klidovém tepu za toto období." };
                  } else {
                    const avgHR = Math.round(data.reduce((acc: number, log: any) => acc + log.heart_rate, 0) / data.length);
                    const minHR = Math.min(...data.map((log: any) => log.heart_rate));
                    const maxHR = Math.max(...data.map((log: any) => log.heart_rate));
                    
                    const recent = data.slice(0, 7).map((log: any, i: number) => {
                      const date = new Date(log.date).toLocaleDateString("cs-CZ");
                      return `${i + 1}. ${date}: ${log.heart_rate} bpm`;
                    }).join("\n");
                    
                    result = { 
                      message: `❤️ Klidový tep (${days} dní):\n\n📊 Statistiky:\n- Průměr: ${avgHR} bpm\n- Min: ${minHR} bpm\n- Max: ${maxHR} bpm\n\n📅 Poslední týden:\n\n${recent}` 
                    };
                  }
                } else if (tc.name === "get_hrv_data") {
                  const args = JSON.parse(tc.arguments);
                  const days = args.days || 30;
                  
                  const { data, error } = await supabase
                    .from("hrv_logs")
                    .select("*")
                    .eq("user_id", userId)
                    .order("date", { ascending: false })
                    .limit(days);
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Žádná HRV data za toto období." };
                  } else {
                    const avgHRV = Math.round(data.reduce((acc: number, log: any) => acc + parseFloat(log.hrv), 0) / data.length);
                    const recent7 = data.slice(0, 7);
                    const avg7 = Math.round(recent7.reduce((acc: number, log: any) => acc + parseFloat(log.hrv), 0) / recent7.length);
                    
                    const trend = avg7 > avgHRV ? "📈 Rostoucí" : avg7 < avgHRV ? "📉 Klesající" : "➡️ Stabilní";
                    
                    const recent = data.slice(0, 7).map((log: any, i: number) => {
                      const date = new Date(log.date).toLocaleDateString("cs-CZ");
                      return `${i + 1}. ${date}: ${Math.round(parseFloat(log.hrv))} ms`;
                    }).join("\n");
                    
                    result = { 
                      message: `💓 HRV analýza (${days} dní):\n\n📊 Statistiky:\n- Průměr za období: ${avgHRV} ms\n- Průměr 7 dní: ${avg7} ms\n- Trend: ${trend}\n\n📅 Poslední týden:\n\n${recent}\n\n💡 Vyšší HRV = lepší zotavení a nižší stres` 
                    };
                  }
                } else if (tc.name === "get_body_composition") {
                  const args = JSON.parse(tc.arguments);
                  const days = args.days || 90;
                  
                  const { data, error } = await supabase
                    .from("body_composition")
                    .select("*")
                    .eq("user_id", userId)
                    .order("date", { ascending: false })
                    .limit(days);
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Žádná data o váze a složení těla za toto období." };
                  } else {
                    const latest = data[0];
                    const oldest = data[data.length - 1];
                    const weightChange = parseFloat(latest.weight_kg) - parseFloat(oldest.weight_kg);
                    const weightTrend = weightChange > 0 ? "↗️" : weightChange < 0 ? "↘️" : "➡️";
                    
                    let message = `⚖️ Váha a složení těla (${days} dní):\n\n📊 Aktuálně:\n- Váha: ${parseFloat(latest.weight_kg).toFixed(1)} kg ${weightTrend}\n`;
                    
                    if (latest.fat_percentage) message += `- Tuk: ${parseFloat(latest.fat_percentage).toFixed(1)}%\n`;
                    if (latest.muscle_percentage) message += `- Svaly: ${parseFloat(latest.muscle_percentage).toFixed(1)}%\n`;
                    if (latest.water_percentage) message += `- Voda: ${parseFloat(latest.water_percentage).toFixed(1)}%\n`;
                    
                    if (Math.abs(weightChange) > 0.1) {
                      message += `\n📈 Změna: ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} kg\n`;
                    }
                    
                    const recent = data.slice(0, 5).map((log: any, i: number) => {
                      const date = new Date(log.date).toLocaleDateString("cs-CZ");
                      return `${i + 1}. ${date}: ${parseFloat(log.weight_kg).toFixed(1)} kg`;
                    }).join("\n");
                    
                    message += `\n📅 Poslední měření:\n\n${recent}`;
                    result = { message };
                  }
                } else if (tc.name === "get_race_goals") {
                  const args = JSON.parse(tc.arguments);
                  let query = supabase
                    .from("race_goals")
                    .select("*")
                    .eq("user_id", userId)
                    .order("race_date", { ascending: true });
                  
                  if (!args.include_completed) {
                    query = query.eq("completed", false);
                  }
                  
                  const { data, error } = await query;
                  
                  if (error) {
                    result = { error: error.message };
                  } else if (!data || data.length === 0) {
                    result = { message: "Zatím nemáš žádné závody v plánu." };
                  } else {
                    const formatted = data.map((goal: any, i: number) => {
                      const date = new Date(goal.race_date).toLocaleDateString("cs-CZ");
                      let info = `${i + 1}. ${goal.race_name} (${goal.race_type})\n   📅 ${date}`;
                      if (goal.target_time) info += `\n   ⏱️ Cíl: ${goal.target_time}`;
                      if (goal.notes) info += `\n   📝 ${goal.notes}`;
                      if (goal.completed) info += `\n   ✅ Dokončeno`;
                      return info;
                    }).join("\n\n");
                    result = { message: `🏁 Plánované závody:\n\n${formatted}` };
                  }
                } else if (tc.name === "add_race_goal") {
                  const args = JSON.parse(tc.arguments);
                  const { error } = await supabase.from("race_goals").insert({
                    user_id: userId,
                    race_name: args.race_name,
                    race_date: args.race_date,
                    race_type: args.race_type,
                    target_time: args.target_time || null,
                    notes: args.notes || "",
                    completed: false
                  });
                  result = error ? { error: error.message } : { success: true, message: `Závod "${args.race_name}" byl přidán do plánu` };
                } else if (tc.name === "search_gmail") {
                  const args = JSON.parse(tc.arguments);
                  console.log("search_gmail called with args:", args);
                  
                  try {
                    const gmailResponse = await supabase.functions.invoke("search-gmail", {
                      headers: {
                        Authorization: authHeader || ""
                      },
                      body: {
                        query: args.query,
                        from: args.from,
                        subject: args.subject,
                        after: args.after,
                        before: args.before,
                        maxResults: args.maxResults || 10
                      }
                    });

                    console.log("Gmail search response:", JSON.stringify(gmailResponse));

                    if (gmailResponse.error) {
                      console.log("Gmail search error:", gmailResponse.error);
                      result = { error: `Chyba při vyhledávání v Gmailu: ${gmailResponse.error.message}` };
                    } else {
                      const data = gmailResponse.data as any;
                      if (data.messages && data.messages.length > 0) {
                        result = { 
                          success: true, 
                          messages: data.messages,
                          count: data.count,
                          summary: `Nalezeno ${data.count} emailů`
                        };
                      } else {
                        result = { success: true, messages: [], count: 0, summary: "Nenalezeny žádné emaily" };
                      }
                    }
                  } catch (error: any) {
                    console.log("Exception when searching Gmail:", error);
                    result = { error: `Chyba: ${error.message}` };
                  }
                } else if (tc.name === "web_search") {
                  const args = JSON.parse(tc.arguments);
                  const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
                  
                  if (!TAVILY_API_KEY) {
                    result = { error: "Vyhledávání není nakonfigurováno" };
                  } else {
                    try {
                      const searchResponse = await fetch("https://api.tavily.com/search", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          api_key: TAVILY_API_KEY,
                          query: args.query,
                          search_depth: "basic",
                          max_results: 5,
                          include_answer: true,
                        }),
                      });
                      
                      const searchData = await searchResponse.json();
                      
                      if (searchData.results && searchData.results.length > 0) {
                        let summary = searchData.answer ? `${searchData.answer}\n\n` : "";
                        summary += "📰 Nalezené zdroje:\n\n";
                        searchData.results.forEach((item: any, idx: number) => {
                          summary += `${idx + 1}. ${item.title}\n   ${item.content}\n   🔗 ${item.url}\n\n`;
                        });
                        result = { message: summary };
                      } else {
                        result = { message: "Nenašel jsem žádné relevantní výsledky." };
                      }
                    } catch (searchError) {
                      console.error("Search error:", searchError);
                      result = { error: "Chyba při vyhledávání" };
                    }
                  }
                }

                toolMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  name: tc.name,
                  content: JSON.stringify(result)
                });

              } catch (e) {
                console.error("Tool execution error:", e);
                toolMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  name: tc.name,
                  content: JSON.stringify({ error: "Chyba při volání nástroje" })
                });
              }
            }

            // Poslat výsledky tool calls zpátky do AI pro finální odpověď
            const followUpMessages = [
              { role: "system", content: systemPrompt },
              ...formattedMessages,
              {
                role: "assistant",
                content: fullResponse || null,
                tool_calls: toolCalls.map(tc => ({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.name,
                    arguments: tc.arguments
                  }
                }))
              },
              ...toolMessages
            ];

            const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: followUpMessages,
                tool_choice: shouldForceCalendar ? { type: "function", function: { name: "create_calendar_event" } } : "auto",
                stream: true,
              }),
            });

            if (!followUpResponse.ok) {
              throw new Error(`AI follow-up error: ${followUpResponse.status}`);
            }

            const followUpReader = followUpResponse.body!.getReader();
            let followUpBuffer = "";
            let followUpResponse2 = "";

            while (true) {
              const { done, value } = await followUpReader.read();
              if (done) break;

              followUpBuffer += decoder.decode(value, { stream: true });
              const lines = followUpBuffer.split("\n");
              followUpBuffer = lines.pop() || "";

              for (const line of lines) {
                if (!line.trim() || line.startsWith(":")) continue;
                if (!line.startsWith("data: ")) continue;

                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    followUpResponse2 += content;
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  }
                } catch (e) {
                  console.error("Parse error in follow-up:", e);
                }
              }
            }

            fullResponse += followUpResponse2;
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));

          // Uložit finální zprávu do databáze
          if (fullResponse || toolCalls.length > 0) {
            const finalContent = fullResponse + (toolCalls.length > 0 ? ` [Provedeno ${toolCalls.length} akcí]` : "");
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              role: "assistant",
              content: finalContent,
            });
          }

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
