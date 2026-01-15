import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

console.log("🚀 CHAT FUNCTION STARTING - VERSION 2.0");
console.log("⏰ Current time:", new Date().toISOString());

serve(async (req) => {
  console.log("🔵 REQUEST RECEIVED - Method:", req.method, "URL:", req.url);

  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request - returning CORS");
    return new Response(null, { headers: corsHeaders });
  }

  console.log("📥 Chat request received");

  try {
    const { messages, mode, conversationId } = await req.json();
    console.log("📋 Request params:", { messageCount: messages?.length, mode, conversationId });
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY není nakonfigurován");
    }

    // Inicializace Supabase klienta
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Service role klient pro databázové operace
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Helper pro logování do databáze
    const logToDb = async (level: 'info' | 'warning' | 'error', message: string, details?: any, userId?: string) => {
      try {
        await supabase.from('logs').insert({
          user_id: userId || null,
          level,
          source: 'chat',
          message,
          details: details || null,
          metadata: { timestamp: new Date().toISOString() }
        });
      } catch (e) {
        console.error('Failed to log to database:', e);
      }
    };

    // Získat user_id z Authorization hlavičky
    const authHeader = req.headers.get("authorization");
    console.log("🔑 Auth header present:", !!authHeader);
    const token = authHeader?.replace("Bearer ", "");
    console.log("🔑 Token extracted:", token ? `${token.substring(0, 20)}...` : "NO TOKEN");

    const callEdgeFunction = async (functionName: string, body: Record<string, unknown>) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader || "",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = rawText;
      }

      if (!response.ok) {
        const message = typeof data === "string"
          ? data
          : data?.error || `HTTP ${response.status}`;
        return { error: { message }, data };
      }

      return { data, error: null };
    };

    // Vytvoříme klienta s Authorization headerem pro ověření uživatele
    const supabaseAuth = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        global: {
          headers: {
            Authorization: authHeader || "",
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError) {
      console.error("❌ Auth error from getUser:", authError);
    }
    console.log("👤 User from token:", user ? user.id : "NO USER");

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
      console.error("❌ AUTH ERROR: No userId found. Token:", token ? "provided" : "missing", "User:", user);
      await logToDb('error', 'Authentication failed', { authError, hasToken: !!token });
      return new Response(
        JSON.stringify({ error: "Nepřihlášený uživatel - session vypršela. Odhlaste se a přihlaste znovu." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ User authenticated:", userId);
    await logToDb('info', 'User authenticated successfully', { userId }, userId);

    // Načíst profil uživatele včetně fitness nastavení a Google tokeny
    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_instructions, trainer_enabled, user_description, strava_refresh_token, google_refresh_token, google_access_token, weight_kg, age, height_cm, bmi, bmr, gender")
      .eq("user_id", userId)
      .maybeSingle();

    // Zkontrolovat, jestli je Google Calendar připojený (potřebujeme to PŘED vytvořením tools)
    const hasGoogleCalendar = !!(profile?.google_refresh_token || profile?.google_access_token);
    console.log("Google Calendar connection status:", hasGoogleCalendar);

    // Načíst aktuální fitness stav (Advanced Metrics)
    const { data: fitnessState } = await supabase
      .from("user_fitness_state")
      .select("ctl, atl, tsb, vo2max, marathon_shape")
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
          name: "log_food_item",
          description: "Zaznamená snědené jídlo do deníku. Použij VŽDY, když uživatel zmiňuje jídlo, kalorie nebo importuje jídelníček. NIKDY nepoužívej add_note pro jídlo.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Název jídla" },
              calories: { type: "number", description: "Kalorie (kcal)" },
              protein: { type: "number", description: "Bílkoviny (g)" },
              carbs: { type: "number", description: "Sacharidy (g)" },
              fat: { type: "number", description: "Tuky (g)" },
              meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"], description: "Typ jídla" }
            },
            required: ["name"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_nutrition_summary",
          description: "Získá souhrn nutričních dat (kalorie, makra) pro konkrétní den nebo období. Použij, když se uživatel ptá na svůj jídelníček, příjem živin nebo chce bilanci.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Konkrétní datum (YYYY-MM-DD)" },
              start_date: { type: "string", description: "Počáteční datum období (YYYY-MM-DD)" },
              end_date: { type: "string", description: "Koncové datum období (YYYY-MM-DD)" }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_training_library",
          description: "Vyhledá informace v tréninkové knihovně. Použij pro dotazy na cviky, běžecké plány, suplementaci nebo BodyCombat.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Hledaný termín (např. 'kreatin', 'běh 10k', 'plank')" }
            },
            required: ["query"],
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
          name: "add_race_goal",
          description: "Přidá nový závodní cíl - maraton, půlmaraton, běh nebo jiný typ závodu s cílovým časem a datem",
          parameters: {
            type: "object",
            properties: {
              race_name: {
                type: "string",
                description: "Název závodu (např. 'Pražský maraton', 'Běchovice - Pražský půlmaraton')"
              },
              race_type: {
                type: "string",
                description: "Typ závodu (např. 'Maraton', 'Půlmaraton', '10 km', '5 km', 'Ultra')"
              },
              race_date: {
                type: "string",
                description: "Datum závodu ve formátu YYYY-MM-DD"
              },
              target_time: {
                type: "string",
                description: "Cílový čas (volitelné, např. '3:30:00', '1:45:00')"
              },
              notes: {
                type: "string",
                description: "Poznámky k závodu (volitelné)"
              }
            },
            required: ["race_name", "race_type", "race_date"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_race_goals",
          description: "Zobrazí naplánované závodní cíle - aktuální i budoucí závody včetně typu, data a cílového času",
          parameters: {
            type: "object",
            properties: {
              include_completed: {
                type: "boolean",
                description: "Zda zahrnout dokončené závody (výchozí: false)"
              }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "remove_race_goal",
          description: "Odstraní závod z plánu podle názvu nebo data",
          parameters: {
            type: "object",
            properties: {
              race_name: {
                type: "string",
                description: "Název závodu k odstranění"
              },
              race_date: {
                type: "string",
                description: "Datum závodu (YYYY-MM-DD) - volitelné pro přesnější identifikaci"
              }
            },
            required: ["race_name"],
            additionalProperties: false
          }
        }
      },
      // Kalendářový tool - pouze pokud je Google Calendar připojený
      ...(hasGoogleCalendar ? [{
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
      }] : []),
      // List calendar events tool - pouze pokud je Google Calendar připojený
      ...(hasGoogleCalendar ? [{
        type: "function",
        function: {
          name: "list_calendar_events",
          description: "Načte a přečte události z Google Kalendáře pro daný den (výchozí dnes). Použij pro dotazy na MŮJ PROGRAM, SCHŮZKY, nebo CO MÁM DĚLAT. NEPOUŽÍVAT pro dotazy na počasí, svátky nebo obecné informace - na to použij web_search.",
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
          name: "manage_calendar",
          description: "Spravuje kalendář: maže nebo přesouvá (upravuje) existující události. PRO VYTVÁŘENÍ NOVÝCH POUŽIJ create_calendar_event.",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["delete", "update", "move"], description: "Akce: delete (smazat), update/move (přesunout/upravit)" },
              query: { type: "string", description: "Hledaný název udalosti (např. 'Zubař')" },
              date_ref: { type: "string", description: "Datum kde hledat (např. '2024-01-20' nebo 'zítra'). Pokud není určeno, použij 'dnes'." },
              new_start: { type: "string", description: "Nový čas začátku (jen pro update/move, ISO 8601 nebo 'zítra 15:00')" },
              new_end: { type: "string", description: "Nový čas konce (jen pro update, volitelné)" },
              new_summary: { type: "string", description: "Nový název (jen pro update, volitelné)" }
            },
            required: ["action", "query"],
            additionalProperties: false
          }
        }
      }] : []),
      {
        type: "function",
        function: {
          name: "web_search",
          description: "Vyhledá informace na internetu. Použij VŽDY pro dotazy na POČASÍ, ZPRÁVY, aktuální události, fakta a cokoliv, co není v tvém osobním kalendáři.",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Hledaný výraz" }
            },
            required: ["query"],
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
        ? 'get_strava_activities, get_health_logs, add_health_log, get_sleep_data, get_resting_heart_rate, get_hrv_data, get_body_composition, get_race_goals, add_race_goal, send_stats_email, get_nutrition_summary, search_training_library'
        : 'get_health_logs, add_health_log, get_sleep_data, get_resting_heart_rate, get_hrv_data, get_body_composition, get_race_goals, add_race_goal, send_stats_email, get_nutrition_summary, search_training_library';

      fitnessContext = `
      
🏃‍♂️ FITNESS TRENÉR: Jsi aktivní fitness trenér s přístupem ke zdravotním datům. Můžeš:
${stravaInfo}- Sledovat zdravotní stav a únavu
- Analyzovat kvalitu spánku a zotavení
- Sledovat klidový tep a HRV pro optimální regeneraci
- Monitorovat váhu a složení těla
- Pomoci s plánováním závodů a cílů
- Poskytovat zdravotní a sportovní rady
- Posílat uživateli statistiky emailem (spánek, HRV, fitness aktivity, tělesné složení)

📌 KARTA "TRENÉR" V APLIKACI:
- Cíle závodů a plánované závody se ukládají do tabulky race_goals
- To, co přidáš pomocí add_race_goal, se zobrazí uživateli na kartě "Trenér" v části "Závody a cíle"

${fitnessState ? `📊 AKTUÁLNÍ KONDICE (Runalyze Metrics):
- CTL (Kondice): ${fitnessState.ctl} (Dlouhodobá zátěž - Fitness)
- ATL (Únava): ${fitnessState.atl} (Krátkodobá zátěž - Fatigue)
- TSB (Forma): ${fitnessState.tsb} (${fitnessState.tsb > 5 ? 'Čerstvý / Ve formě' : fitnessState.tsb < -20 ? 'Velmi unavený / Přetrénovaný' : 'V tréninku / Neutrální'})
- VO2max (Odhad): ${fitnessState.vo2max}
- Maratónská forma: ${fitnessState.marathon_shape}%

INTERPRETACE TSB (Forma = Fitness - Únava):
- TSB > +5: Uživatel je čerstvý (Fresh). Ideální pro závod nebo lámání rekordů.
- TSB -10 až +5: Optimální tréninková zóna (Gray Zone).
- TSB -30 až -10: Produktivní trénink (Optimal Training). Uživatel může cítit únavu, ale buduje kondici.
- TSB < -30: Vysoké riziko přetrénování (Overreach)! DŮRAZNĚ doporuč odpočinek nebo lehký výklus. Nepouštěj ho do intenzity!
` : ''}

${profileInfo}

Máš k dispozici nástroje: ${availableTools}

DŮLEŽITÉ: 
- Když se uživatel ptá na spánek, HRV, klidový tep nebo složení těla, AKTIVNĚ použij příslušné nástroje (get_sleep_data, get_hrv_data, get_resting_heart_rate, get_body_composition) pro získání aktuálních dat!
- Když uživatel chce poslat statistiky emailem (např. "pošli mi jak jsem spal poslední týden", "pošli mi HRV data", "pošli mi statistiky běhů"), použij send_stats_email s příslušným statsType (sleep/hrv/heart_rate/body_composition/fitness)
- Když uživatel chce přidat závod nebo cíl (např. "přidej závod", "chci běžet maraton", "naplánuj mi závod", "mám závod v květnu"), VŽDY použij add_race_goal – tyto závody se uloží do race_goals a zobrazí se na kartě "Trenér" v části "Závody a cíle"
- Pro zobrazení plánovaných závodů použij get_race_goals a popiš je tak, jak jsou vidět na kartě "Trenér"
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

POZNÁMKA: Kalendářové funkce jsou dočasně nedostupné (Google Calendar není připojený). Použij add_note pro vytváření upomínek a poznámek s termínem.

Umíš spravovat poznámky uživatele pomocí nástrojů:

- add_note: Pro uložení nové poznámky (s možností nastavit termín dokončení, místo, upomínku a opakování)
- log_food_item: Pro záznam jídla a kalorií do deníku (použij VŽDY pro jídlo místo add_note)
- get_notes: Pro zobrazení poznámek
- delete_note: Pro smazání poznámky
- get_notes_by_date: Pro zobrazení poznámek s termínem na konkrétní den (např. "co mám zítra", "co mám tento týden")
- create_summary: Pro vytvoření sumáru poznámek
- reschedule_note: Pro přeplánování poznámky na jiný termín
- send_notes_email: Pro odeslání poznámek emailem (jednotlivé poznámky nebo sumář)
- send_stats_email: Pro odeslání fitness a wellness statistik emailem (spánek, HRV, fitness aktivity, tělesné složení)
- search_gmail: Pro vyhledávání a čtení emailů v Gmail účtu uživatele
- web_search: Pro vyhledání aktuálních informací, článků, zpráv, doporučení filmů, seriálů, knih a dalšího

Když se uživatel ptá na plány (např. "co mám zítra", "co mám naplánováno"), použij get_notes_by_date nebo list_calendar_events. Pro sumár použij create_summary. Pro přeplánování použij reschedule_note. Pro odeslání poznámek emailem použij send_notes_email. Pro odeslání statistik emailem (např. "pošli mi jak jsem spal poslední týden") použij send_stats_email. Pro vytvoření události v kalendáři použij create_calendar_event. Pro vyhledávání v emailech (např. "najdi emaily od banky", "co mi přišlo od Petra") použij search_gmail. Když se ptá na doporučení filmů/seriálů/článků nebo chce aktuální informace, použij web_search. Pro záznam jídla (např. "snědl jsem jablko") použij log_food_item.`
      : `⏰ AKTUÁLNÍ DATUM A ČAS: ${currentDateTime} (${currentDateISO})
📅 ROK: ${currentYear} - DŮLEŽITÉ: Při práci s daty VŽDY používej rok ${currentYear}!

Jsi M.A.R.K. (My Assistant Raspberry Kit) - základní hlasový asistent. Mluvíš česky a jsi jednoduchý a přímočarý.

DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

ANALÝZA FOTEK: Když uživatel pošle fotku, popiš co vidíš a pokud obsahuje něco důležitého (úkol, termín...), ulož to pomocí add_note. Pokud je na fotce jídlo, použij log_food_item.

POZNÁMKA: Kalendářové funkce jsou dočasně nedostupné. Použij add_note pro upomínky.

Umíš spravovat poznámky pomocí nástrojů add_note, log_food_item, get_notes, delete_note, get_notes_by_date, create_summary, reschedule_note, send_notes_email, send_stats_email, search_gmail, web_search. 
      
      NOVÉ SCHOPNOSTI:
      1. NUTRIČNÍ SPECIALISTA: Když se uživatel ptá na svůj jídelníček ("kolik jsem snědl", "mám dost bílkovin"), použij 'get_nutrition_summary'. Pro záznam jídla použij 'log_food_item'.
      2. TRENÉR & KNIHOVNA: Když uživatel hledá cviky, plány nebo rady o suplementech ("jak běhat maraton", "co je kreatin"), použij 'search_training_library'.
      
      DŮLEŽITÉ PRAVIDLA PRO NÁSTROJE:
      - POČASÍ A ZPRÁVY: Když se uživatel ptá na POČASÍ ("jak bude zítra", "prší dnes?", "předpověď") nebo ZPRÁVY/NOVINKY ("co se děje ve světě"), MUSÍŠ použít 'web_search'. NIKDY nepoužívej kalendář pro tyto dotazy!
      - KALENDÁŘ: 'list_calendar_events' nebo 'get_notes_by_date' použij POUZE, když se uživatel ptá na SVŮJ OSOBNÍ PROGRAM, schůzky nebo plány ("co mám zítra v plánu", "kdy mám zubaře").
      
      Pro odeslání poznámek emailem použij send_notes_email. Pro odeslání fitness/wellness statistik emailem použij send_stats_email. Pro vytvoření události v kalendáři použij create_calendar_event. Pro vyhledání v emailech použij search_gmail. Pro jídlo použij log_food_item.`;


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
      // Czech variants (normalized diacritics handled below)
      "kalend",          // matches kalendář, kalendare, kalendari
      "v kalend",
      "do kalend",
      "událost",
      "udalost",
      "schůzk",
      "schuzk",
      "celodenn",
      // Common explicit phrases
      "vytvoř v kalendáři",
      "přidej do kalendáře",
      "vytvoř událost",
      "přidej schůzku",
      // Intent words strongly tied to calendar actions
      "naplánuj",
      "naplan",
      "upomeň",
      "upomínku",
      "upominku",
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
      "run",
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
      "kvalita spánku",
    ];

    // Gmail klíčová slova (CZ/EN) pro vyhledávání v emailech
    const gmailKeywords = [
      "email",
      "e-mail",
      "e-maily",
      "emails",
      "mail",
      "maily",
      "mailů",
      "mailu",
      "gmail",
      "pošta",
      "schránka",
      "najdi email",
      "v emailech",
      "od banky",
      "banky",
      "faktury",
      "objednávky",
    ];

    // Klíčová slova pro závody/cíle (race_goals)
    const raceKeywords = [
      "závod",
      "závody",
      "zavod",
      "zavody",
      "cíl závodu",
      "cíle závodů",
      "cil zavodu",
      "cil",
      "cíl",
      "maraton",
      "půlmaraton",
      "pulmaraton",
      "10k",
      "5k",
      "běžecký závod",
      "bezecky zavod",
      "plán závodů",
      "plan zavodu",
    ];

    const normIncludes = (text: string, words: string[]) => {
      const t = normalizeText(text);
      return words.some((w) => t.includes(normalizeText(w)));
    };

    // hasGoogleCalendar už je definované výše (na začátku funkce)

    const shouldForceCalendar = !!lastUserText && hasGoogleCalendar && normIncludes(lastUserText, calendarKeywords);
    const scheduleQuestion = !!lastUserText && (
      lastUserTextNorm.includes("co mam") ||
      lastUserTextNorm.includes("co mam zitra") ||
      lastUserTextNorm.includes("co mam dnes") ||
      lastUserTextNorm.includes("mam zitra") ||
      lastUserTextNorm.includes("mam dnes") ||
      lastUserTextNorm.includes("jaky mam plan") ||
      lastUserTextNorm.includes("jaky mam zitra") ||
      lastUserTextNorm.includes("co za udalosti") ||
      lastUserTextNorm.includes("co mam za udalosti") ||
      lastUserTextNorm.includes("na zitrek") ||
      lastUserTextNorm.includes("zitr") ||
      lastUserTextNorm.includes("plan") ||
      lastUserTextNorm.includes("rozvrh") ||
      lastUserTextNorm.includes("agenda") ||
      lastUserTextNorm.includes("program") ||
      lastUserTextNorm.includes("naplanov") ||
      lastUserTextNorm.includes("co me ceka") ||
      lastUserTextNorm.includes("cek") ||
      (
        (lastUserTextNorm.includes("zitr") || lastUserTextNorm.includes("dnes") || lastUserTextNorm.includes("plan") || lastUserTextNorm.includes("tyden") || lastUserTextNorm.includes("vikend")) &&
        (lastUserTextNorm.includes("udalost") || lastUserTextNorm.includes("kalendar") || lastUserTextNorm.includes("schuzk") || lastUserTextNorm.includes("program") || lastUserTextNorm.includes("rozvrh"))
      )
    ) && !lastUserTextNorm.includes("pocasi") && !lastUserTextNorm.includes("zpravy");
    const shouldForceCalendarList = !!lastUserText && hasGoogleCalendar && scheduleQuestion && !shouldForceCalendar;
    const shouldForceSleep = !!lastUserText && normIncludes(lastUserText, sleepKeywords);
    const shouldForceStrava =
      !!lastUserText &&
      hasStravaConnected &&
      !shouldForceSleep &&
      normIncludes(lastUserText, stravaKeywords);
    const shouldForceGmail = !!lastUserText && normIncludes(lastUserText, gmailKeywords);
    const shouldForceRaceGoal =
      !!lastUserText &&
      normIncludes(lastUserText, raceKeywords) &&
      !shouldForceCalendar &&
      !shouldForceStrava;

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
    else if (shouldForceCalendarList) toolChoiceLog = "force:list_calendar_events";
    else if (shouldForceRaceGoal) toolChoiceLog = "force:add_race_goal";
    else if (shouldForceSleep) toolChoiceLog = "force:get_sleep_data";
    else if (shouldForceStrava) toolChoiceLog = "force:get_strava_activities";
    else if (shouldForceGmail) toolChoiceLog = "force:search_gmail";
    console.log("AI tool_choice:", toolChoiceLog, {
      shouldForceCalendar,
      shouldForceCalendarList,
      shouldForceSleep,
      shouldForceStrava,
      shouldForceGmail,
      shouldForceRaceGoal,
      scheduleQuestion,
    });

    // Přímý dotaz na kalendář bez LLM (např. "co mám zítra")
    if (scheduleQuestion && hasGoogleCalendar) {
      const lowerText = lastUserText.toLowerCase();
      const d = new Date();
      if (lowerText.includes("zitra") || lowerText.includes("zítra")) d.setDate(d.getDate() + 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const date = `${yyyy}-${mm}-${dd}`;

      const listResp = await callEdgeFunction("list-calendar-events", { date });
      let text = "";
      if (listResp.error) {
        text = `Chyba při načítání kalendáře: ${listResp.error.message}`;
      } else {
        const items = (listResp.data as any)?.items || [];
        if (items.length === 0) {
          text = "Nemáš žádné události.";
        } else {
          const formatted = items.map((ev: any, i: number) => {
            const start = ev.start?.dateTime || ev.start?.date;
            const time = start ? new Date(start).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "";
            return `${i + 1}. ${time} ${ev.summary || "Bez názvu"}`.trim();
          }).join("\n");
          text = `📅 Události:\n${formatted}`;
        }
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const delta = {
            id: `gen-${Date.now()}`,
            model: "internal",
            object: "chat.completion.chunk",
            created: Date.now(),
            choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: "stop" }]
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        }
      });

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: `${text} [Provedeno 1 akcí]`
      });

      return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    await logToDb('info', 'Starting OpenAI API call', {
      model: 'gpt-4o-mini',
      messageCount: formattedMessages.length,
      hasTools: tools.length > 0
    }, userId);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages,
        ],
        tools,
        tool_choice: shouldForceCalendar
          ? { type: "function", function: { name: "create_calendar_event" } }
          : shouldForceCalendarList
            ? { type: "function", function: { name: "list_calendar_events" } }
            : shouldForceRaceGoal
              ? { type: "function", function: { name: "add_race_goal" } }
              : shouldForceStrava
                ? { type: "function", function: { name: "get_strava_activities" } }
                : shouldForceSleep
                  ? { type: "function", function: { name: "get_sleep_data" } }
                  : shouldForceGmail
                    ? { type: "function", function: { name: "search_gmail" } }
                    : "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      // KALENDÁŘOVÝ FALLBACK DOČASNĚ ZAKÁZÁN
      if (false && (response.status === 402 || response.status === 429) && shouldForceCalendar && hasGoogleCalendar && lastUserText) {
        // No AI credits/rate limit but user asked for calendar → create event deterministically and stream a single message
        // POZOR: Pouze pokud je Google Calendar připojený!
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              console.log("AI credits/rate limit; using calendar fallback for:", lastUserText);
              // Simple CZ parser: today/tomorrow + HH[:MM]; default 9:00
              const nowLocal = new Date();
              let base = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate(), 9, 0, 0, 0);
              if (lastUserText.includes("zítra") || lastUserText.includes("zitra")) {
                base.setDate(base.getDate() + 1);
              }
              const timeMatch = lastUserText.match(/(\d{1,2})(?::|(\.))?(\d{2})?/);
              let hour = 9;
              let minute = 0;
              if (timeMatch) {
                hour = parseInt(timeMatch[1], 10);
                if (timeMatch[3]) minute = parseInt(timeMatch[3], 10) || 0;
              }
              const year = base.getFullYear();
              const month = String(base.getMonth() + 1).padStart(2, '0');
              const day = String(base.getDate()).padStart(2, '0');
              const hourStr = String(hour).padStart(2, '0');
              const minuteStr = String(minute).padStart(2, '0');
              const startIso = `${year}-${month}-${day}T${hourStr}:${minuteStr}:00`;

              let summary = "Událost";
              const colonIdx = lastUserText.indexOf(":");
              if (colonIdx !== -1) {
                const s = lastUserText.slice(colonIdx + 1).trim();
                if (s) summary = s;
              } else if (lastUserText.includes("upom")) {
                summary = "Upomínka";
              } else if (lastUserText.includes("schůz") || lastUserText.includes("schuz")) {
                summary = "Schůzka";
              }

              const calResp = await callEdgeFunction("create-calendar-event", {
                summary,
                start: startIso,
              });

              let text = "";
              if (calResp.error || !(calResp.data as any)?.success) {
                const errorMsg = calResp.error?.message || (calResp.data as any)?.error || "Nepodařilo se vytvořit událost v Google Kalendáři";
                text = `Chyba AI (kredity/limit), ale zkusil jsem vytvořit událost přímo: ${errorMsg}.`;
              } else {
                const eventLink = (calResp.data as any)?.eventLink;
                const created = new Date(startIso).toLocaleString("cs-CZ");
                text = eventLink
                  ? `Událost "${summary}" vytvořena v Google Kalendáři (${created}). Odkaz: ${eventLink}`
                  : `Událost "${summary}" vytvořena v Google Kalendáři (${created}).`;
              }

              const delta = {
                id: `gen-${Date.now()}`,
                provider: "internal",
                model: "internal",
                object: "chat.completion.chunk",
                created: Date.now(),
                choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              controller.close();
            } catch (e) {
              console.error("Calendar fallback (no AI) failed:", e);
              const errDelta = {
                id: `gen-${Date.now()}`,
                provider: "internal",
                model: "internal",
                object: "chat.completion.chunk",
                created: Date.now(),
                choices: [{ index: 0, delta: { role: "assistant", content: "Nepodařilo se vytvořit událost. Otevři Nastavení → Test Google Kalendáře a vyzkoušej to prosím přímo." }, finish_reason: null }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errDelta)}\n\n`));
              controller.enqueue(encoder.encode(`data: [DONE]` + "\n\n"));
              controller.close();
            }
          }
        });
        return new Response(stream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      if (response.status === 429) {
        await logToDb('error', 'OpenAI API rate limit exceeded', { status: 429 }, userId);
        return new Response(
          JSON.stringify({ error: "Překročen limit požadavků. Zkuste to prosím později." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        await logToDb('error', 'OpenAI API credits exhausted', { status: 402 }, userId);
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
          // KALENDÁŘOVÝ FALLBACK DOČASNĚ ZAKÁZÁN - календář nefunguje správně
          if (false && toolCalls.length === 0 && shouldForceCalendar && hasGoogleCalendar && lastUserText) {
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

              const calResp = await callEdgeFunction("create-calendar-event", {
                summary,
                start: startIso,
              });

              if (calResp.error || !(calResp.data as any)?.success) {
                const errorMsg = calResp.error?.message || (calResp.data as any)?.error || "Nepodařilo se vytvořit událost v Google Kalendáři";
                console.error("Calendar fallback error:", errorMsg);
                const errorNote = `Chyba při vytváření události: ${errorMsg}. Zkontroluj prosím připojení ke Google Kalendáři v Nastavení.`;
                fullResponse += `\n\n${errorNote}`;
                const delta = {
                  id: `gen-${Date.now()}`,
                  provider: "internal",
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: `\n${errorNote}` }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
              } else {
                const eventLink = (calResp.data as any)?.eventLink;
                const note = eventLink
                  ? `Událost \"${summary}\" vytvořena v Google Kalendáři (${new Date(startIso).toLocaleString("cs-CZ")}). [Zobrazit v kalendáři](${eventLink})`
                  : `Událost \"${summary}\" vytvořena v Google Kalendáři (${new Date(startIso).toLocaleString("cs-CZ")}).`;
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
              let fallbackQuery = lastUserText;
              const lowerText = lastUserText.toLowerCase();
              if (lowerText.includes("poslední hodinu") || lowerText.includes("posledni hodinu") || lowerText.includes("last hour")) {
                fallbackQuery = "newer_than:1h";
              } else if (lowerText.includes("dnes") || lowerText.includes("today")) {
                fallbackQuery = "newer_than:1d";
              }

              const { data: gmailData, error: gmailError } = await callEdgeFunction("search-gmail", {
                query: fallbackQuery,
                maxResults: 10
              });
              if (gmailError) {
                console.error("Gmail fallback error:", gmailError);
              } else if ((gmailData as any)?.messages?.length) {
                const cnt = (gmailData as any).count || (gmailData as any).messages.length;
                const items = (gmailData as any).messages.slice(0, 5).map((m: any, idx: number) => {
                  const from = m.from ? m.from.replace(/<[^>]+>/g, "").trim() : "Neznámý odesílatel";
                  const subject = m.subject || "Bez předmětu";
                  return `${idx + 1}. ${from} — ${subject}`;
                }).join("\n");
                const note = `Nalezeno ${cnt} e-mailů.\n${items}`;
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

              // Čtení dat z databáze místo volání Strava API
              const beforeDate = new Date(Number(stravaBeforeTs) * 1000).toISOString();
              const afterDate = new Date(Number(stravaAfterTs) * 1000).toISOString();

              const { data: activities, error: dbError } = await supabase
                .from("strava_activities")
                .select("*")
                .eq("user_id", userId)
                .lte("start_date", beforeDate)
                .gte("start_date", afterDate)
                .order("start_date", { ascending: false })
                .limit(30);

              if (dbError) {
                console.error("Database error:", dbError);
              } else if (!activities || activities.length === 0) {
                const errDelta = {
                  id: crypto.randomUUID(),
                  model: "internal",
                  object: "chat.completion.chunk",
                  created: Date.now(),
                  choices: [{ index: 0, delta: { role: "assistant", content: "\n📊 Zatím nemáš žádné aktivity za poslední týden v databázi. Zkus synchronizovat data ze Stravy v sekci Trenér." }, finish_reason: null }]
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(errDelta)}\n\n`));
              } else {
                const formatted = activities.slice(0, 10).map((act: any, i: number) => {
                  const date = new Date(act.start_date).toLocaleDateString("cs-CZ");
                  const distance = act.distance_meters ? (act.distance_meters / 1000).toFixed(2) : "0";
                  const time = act.moving_time_seconds ? Math.floor(act.moving_time_seconds / 60) : 0;
                  return `${i + 1}. ${act.name} (${act.activity_type})\n   📅 ${date} | 📏 ${distance} km | ⏱️ ${time} min`;
                }).join("\n\n");
                const msg = `🏃 Poslední aktivity (7 dní):\n\n${formatted}`;

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

                const msg = `😴 Spánek (posledních 7 nocí):\n\nPrůměr: ${Math.floor(avgDuration / 60)}h ${avgDuration % 60}min\n\n${formatted}`;
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

                await logToDb('info', `Executing tool: ${tc.name}`, {
                  toolName: tc.name,
                  arguments: args
                }, userId);

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
                } else if (tc.name === "log_food_item") {
                  const args = JSON.parse(tc.arguments);

                  const { error } = await supabase.from("calorie_entries").insert({
                    user_id: userId,
                    meal_name: args.name + (args.meal_type ? ` (${args.meal_type})` : ""),
                    calories: args.calories || 0,
                    protein: args.protein || null,
                    carbs: args.carbs || null,
                    fat: args.fat || null,
                    entry_date: new Date().toISOString().split('T')[0],
                    source: 'ai'
                  });

                  if (error) {
                    result = { error: `Chyba při ukládání jídla: ${error.message}` };
                  } else {
                    const parts = [];
                    if (args.calories) parts.push(`${args.calories} kcal`);
                    if (args.protein) parts.push(`${args.protein}g B`);
                    if (args.carbs) parts.push(`${args.carbs}g S`);
                    if (args.fat) parts.push(`${args.fat}g T`);

                    const details = parts.length > 0 ? ` (${parts.join(", ")})` : "";
                    result = {
                      success: true,
                      message: `Zapsáno do jídelníčku: ${args.name}${details}.`
                    };
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

                    const calendarResponse = await callEdgeFunction("create-calendar-event", {
                      summary: args.summary || "Událost",
                      start: startIso,
                      end: args.end,
                      location: args.location,
                      description: args.description,
                    });

                    if (calendarResponse.error || !(calendarResponse.data as any)?.success) {
                      const errorMsg = calendarResponse.error?.message || (calendarResponse.data as any)?.error || "Nepodařilo se vytvořit událost";
                      console.error("Calendar create error:", errorMsg);
                      result = {
                        error: `${errorMsg}. Zkontroluj prosím připojení ke Google Kalendáři v Nastavení a ujisti se, že máš správná oprávnění.`
                      };
                    } else {
                      const eventLink = (calendarResponse.data as any)?.eventLink;
                      const eventId = (calendarResponse.data as any)?.eventId;
                      console.log("Calendar event created:", { eventId, eventLink });

                      // Ověř vytvoření načtením událostí z daného dne
                      const dateForVerification = startIso.split('T')[0];
                      try {
                        const verifyResp = await callEdgeFunction("list-calendar-events", {
                          date: dateForVerification,
                        });
                        const events = (verifyResp.data as any)?.items || [];
                        const foundEvent = events.find((e: any) =>
                          e.summary === (args.summary || "Událost") ||
                          (e.id && eventId && e.id.includes(eventId))
                        );
                        if (foundEvent) {
                          console.log("Event verified in calendar:", foundEvent.summary);
                        } else {
                          console.warn("Event created but not found in verification");
                        }
                      } catch (verifyErr) {
                        console.warn("Could not verify event creation:", verifyErr);
                      }

                      result = {
                        success: true,
                        message: eventLink
                          ? `Událost "${args.summary || "Událost"}" vytvořena v Google Kalendáři. [Zobrazit](${eventLink})`
                          : `Událost "${args.summary || "Událost"}" vytvořena v Google Kalendáři.`,
                        link: eventLink
                      };
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "list_calendar_events") {
                  const args = JSON.parse(tc.arguments);
                  const date = args.date;
                  try {
                    const listResp = await callEdgeFunction("list-calendar-events", {
                      date
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
                } else if (tc.name === "manage_calendar") {
                  const args = JSON.parse(tc.arguments);
                  const action = args.action;
                  const queryStr = (args.query || "").toLowerCase();

                  // Helper pro určení data hledání
                  const resolveDate = (ref: string): string => {
                    const d = new Date();
                    const r = (ref || "").toLowerCase();
                    if (r.includes("zítra") || r.includes("zitra")) d.setDate(d.getDate() + 1);
                    else if (r.includes("pozítří") || r.includes("pozitri")) d.setDate(d.getDate() + 2);
                    else if (r.match(/^\d{4}-\d{2}-\d{2}/)) return r.substring(0, 10);
                    return d.toISOString().split('T')[0];
                  };

                  const dateForSearch = resolveDate(args.date_ref);

                  try {
                    // 1. Najít události
                    const listResp = await callEdgeFunction("list-calendar-events", { date: dateForSearch });
                    if (listResp.error) throw new Error(listResp.error.message);

                    const items = (listResp.data as any)?.items || [];

                    // 2. Filtrovat
                    const matches = items.filter((ev: any) =>
                      (ev.summary || "").toLowerCase().includes(queryStr)
                    );

                    if (matches.length === 0) {
                      result = { message: `Nenašel jsem žádnou událost obsahující "${args.query}" pro datum ${dateForSearch}.` };
                    } else if (matches.length > 1) {
                      const names = matches.map((m: any) => m.summary).join(", ");
                      result = { message: `Našel jsem více událostí (${names}). Prosím upřesni název.` };
                    } else {
                      // Přesně 1 shoda
                      const eventId = matches[0].id;

                      if (action === "delete") {
                        const delResp = await callEdgeFunction("delete-calendar-event", { eventId });
                        if (delResp.error) {
                          result = { error: delResp.error.message };
                        } else {
                          result = { success: true, message: `Událost "${matches[0].summary}" byla úspěšně smazána.` };
                        }
                      } else if (action === "update" || action === "move") {
                        const updateBody: any = { eventId };
                        if (args.new_summary) updateBody.summary = args.new_summary;
                        if (args.new_start) updateBody.start = args.new_start;
                        if (args.new_end) updateBody.end = args.new_end;

                        const upResp = await callEdgeFunction("update-calendar-event", updateBody);
                        if (upResp.error) {
                          result = { error: upResp.error.message };
                        } else {
                          result = { success: true, message: `Událost "${matches[0].summary}" byla upravena.` };
                        }
                      }
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "web_search") {
                  const args = JSON.parse(tc.arguments);
                  try {
                    const searchResp = await callEdgeFunction("search-web", {
                      query: args.query
                    });

                    if (searchResp.error) {
                      result = { error: searchResp.error.message };
                    } else {
                      const data = searchResp.data as any;
                      const answer = data.answer;
                      const items = data.results || [];

                      let text = "";
                      if (answer) {
                        text += `💡 Odpověď: ${answer}\n\n`;
                      }

                      if (items.length > 0) {
                        text += "🔍 Zdroje:\n" + items.map((i: any) => `- [${i.title}](${i.url}): ${i.content.substring(0, 150)}...`).join("\n");
                      } else {
                        text += "Nebyly nalezeny žádné relevantní výsledky.";
                      }

                      result = { message: text };
                    }
                  } catch (error: any) {
                    result = { error: error.message };
                  }
                } else if (tc.name === "get_strava_activities") {
                  const args = JSON.parse(tc.arguments);
                  try {
                    // Čtení aktivit z databáze místo volání Strava API
                    let query = supabase
                      .from("strava_activities")
                      .select("*")
                      .eq("user_id", userId)
                      .order("start_date", { ascending: false });

                    // Filtrování podle časového rozsahu
                    if (args.before) {
                      const beforeDate = new Date(Number(args.before) * 1000).toISOString();
                      query = query.lte("start_date", beforeDate);
                    }
                    if (args.after) {
                      const afterDate = new Date(Number(args.after) * 1000).toISOString();
                      query = query.gte("start_date", afterDate);
                    }

                    // Limit počtu aktivit
                    const limit = args.limit || 10;
                    query = query.limit(limit);

                    const { data: activities, error: dbError } = await query;

                    if (dbError) {
                      result = { error: dbError.message };
                    } else if (!activities || activities.length === 0) {
                      result = { message: "Zatím nemáš žádné aktivity v daném období. Zkus synchronizovat data ze Stravy v sekci Trenér." };
                    } else {
                      const formatted = activities.map((act: any, i: number) => {
                        const date = new Date(act.start_date).toLocaleDateString("cs-CZ");
                        const distance = act.distance_meters ? (act.distance_meters / 1000).toFixed(2) : "0";
                        const time = act.moving_time_seconds ? Math.floor(act.moving_time_seconds / 60) : 0;
                        let details = `${i + 1}. ${act.name} (${act.activity_type})\n   📅 ${date} | 📏 ${distance} km | ⏱️ ${time} min`;

                        // Přidáme tepovou frekvenci, pokud je dostupná
                        if (act.average_heartrate) {
                          details += `\n   ❤️ Průměrný tep: ${Math.round(act.average_heartrate)} bpm`;
                        }
                        if (act.max_heartrate) {
                          details += ` | Max tep: ${Math.round(act.max_heartrate)} bpm`;
                        }

                        // Přidáme převýšení, pokud je dostupné
                        if (act.total_elevation_gain) {
                          details += `\n   ⛰️ Převýšení: ${Math.round(act.total_elevation_gain)} m`;
                        }

                        // Přidáme kalorie, pokud jsou dostupné
                        if (act.calories) {
                          details += `\n   🔥 Kalorie: ${Math.round(act.calories)} kcal`;
                        }

                        return details;
                      }).join("\n\n");
                      result = { message: `🏃 Našel jsem ${activities.length} aktivit:\n\n${formatted}` };
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
                      message: `😴 Spánková analýza (${days} dní):\n\n📊 Průměry:\n- Délka: ${Math.floor(avgDuration / 60)}h ${avgDuration % 60}min\n- Kvalita: ${avgQuality}/10\n- Hluboký spánek: ${avgDeep}min\n\n📅 Poslední noci:\n\n${formatted}`
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
                } else if (tc.name === "remove_race_goal") {
                  const args = JSON.parse(tc.arguments);
                  let query = supabase
                    .from("race_goals")
                    .delete()
                    .eq("user_id", userId)
                    .ilike("race_name", `%${args.race_name}%`);

                  if (args.race_date) {
                    query = query.eq("race_date", args.race_date);
                  }

                  const { error, count } = await query;
                  result = error
                    ? { error: error.message }
                    : count && count > 0
                      ? { success: true, message: `Závod "${args.race_name}" byl odstraněn z plánu` }
                      : { error: `Závod "${args.race_name}" nebyl nalezen` };
                } else if (tc.name === "search_gmail") {
                  const args = JSON.parse(tc.arguments);
                  console.log("search_gmail called with args:", args);

                  try {
                    const text = (lastUserText || "").toLowerCase();
                    let gmailQuery = args.query;
                    if (!gmailQuery) {
                      if (text.includes("poslední hodinu") || text.includes("posledni hodinu") || text.includes("last hour")) {
                        gmailQuery = "newer_than:1h";
                      } else if (text.includes("dnes") || text.includes("today")) {
                        gmailQuery = "newer_than:1d";
                      }
                    }

                    const gmailResponse = await callEdgeFunction("search-gmail", {
                      query: gmailQuery,
                      from: args.from,
                      subject: args.subject,
                      after: args.after,
                      before: args.before,
                      maxResults: args.maxResults || 10
                    });

                    console.log("Gmail search response:", JSON.stringify(gmailResponse));

                    if (gmailResponse.error) {
                      console.log("Gmail search error:", gmailResponse.error);
                      result = { error: `Chyba při vyhledávání v Gmailu: ${gmailResponse.error.message}` };
                    } else {
                      const data = gmailResponse.data as any;
                      if (data.messages && data.messages.length > 0) {
                        const items = data.messages.slice(0, 8).map((m: any, idx: number) => {
                          const from = m.from ? m.from.replace(/<[^>]+>/g, "").trim() : "Neznámý odesílatel";
                          const subject = m.subject || "Bez předmětu";
                          const date = m.date ? new Date(m.date).toLocaleString("cs-CZ") : "";
                          const when = date ? ` (${date})` : "";
                          return `${idx + 1}. ${from} — ${subject}${when}`;
                        }).join("\n");
                        result = {
                          success: true,
                          messages: data.messages.map((m: any) => ({
                            id: m.id,
                            from: m.from,
                            subject: m.subject,
                            date: m.date,
                            snippet: m.snippet,
                          })),
                          count: data.count,
                          summary: `Nalezeno ${data.count} emailů.\n${items}`
                        };
                      } else {
                        result = { success: true, messages: [], count: 0, summary: "Nenalezeny žádné emaily" };
                      }
                    }
                  } catch (error: any) {
                    console.log("Exception when searching Gmail:", error);
                    result = { error: `Chyba: ${error.message}` };
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
                await logToDb('error', `Tool execution failed: ${tc.name}`, {
                  toolName: tc.name,
                  error: e instanceof Error ? e.message : String(e)
                }, userId);
                toolMessages.push({
                  role: "tool",
                  tool_call_id: tc.id,
                  name: tc.name,
                  content: JSON.stringify({ error: "Chyba při volání nástroje" })
                });
              }
            }

            // Shortcut: for Gmail tool calls, reply directly to avoid follow-up AI failures
            if (toolCalls.length === 1 && toolCalls[0].name === "search_gmail") {
              let responseText = "Nepodařilo se načíst emaily.";
              try {
                const toolContent = JSON.parse(toolMessages[0].content);
                if (toolContent?.error) {
                  responseText = toolContent.error;
                } else if (toolContent?.summary) {
                  responseText = toolContent.summary;
                } else if (toolContent?.messages?.length === 0) {
                  responseText = "Nenalezeny žádné emaily.";
                }
              } catch {
                // keep default responseText
              }

              const delta = {
                id: `gen-${Date.now()}`,
                provider: "internal",
                model: "internal",
                object: "chat.completion.chunk",
                created: Date.now(),
                choices: [{ index: 0, delta: { role: "assistant", content: responseText }, finish_reason: null }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(delta)}\n\n`));
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              controller.close();

              await supabase.from("messages").insert({
                conversation_id: conversationId,
                role: "assistant",
                content: `${responseText} [Provedeno 1 akcí]`
              });

              return;
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

            const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: followUpMessages,
                stream: true,
              }),
            });

            if (!followUpResponse.ok) {
              console.error("AI follow-up error:", followUpResponse.status);
              const errorText = await followUpResponse.text();
              console.error("AI follow-up error details:", errorText);

              // Namísto vyhození chyby, pošleme uživateli informativní zprávu
              const errorMsg = `Omlouvám se, došlo k chybě při zpracování odpovědi. Zkuste to prosím znovu.`;
              const errorDelta = {
                id: `error-${Date.now()}`,
                model: "internal",
                object: "chat.completion.chunk",
                created: Date.now(),
                choices: [{ index: 0, delta: { role: "assistant", content: errorMsg }, finish_reason: "stop" }]
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorDelta)}\n\n`));
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              controller.close();

              // Uložit chybovou zprávu do databáze
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                role: "assistant",
                content: errorMsg
              });
              return;
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

    // Try to log to database (best effort, userId might not be available)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from('logs').insert({
        user_id: null,
        level: 'error',
        source: 'chat',
        message: 'Critical chat error',
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (logError) {
      console.error('Failed to log critical error:', logError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Neznámá chyba" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
