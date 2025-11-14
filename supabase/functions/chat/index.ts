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
      .select("custom_instructions, trainer_enabled, user_description, strava_refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    const customInstructions = profile?.custom_instructions || "";
    const trainerEnabled = profile?.trainer_enabled ?? true;
    const userDescription = profile?.user_description || "";
    const hasStravaConnected = !!profile?.strava_refresh_token;

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
      }
    ];

    // Fitness kontext pro trenérský režim
    let fitnessContext = "";
    if (trainerEnabled && hasStravaConnected) {
      fitnessContext = `

🏃‍♂️ FITNESS TRENÉR: Jsi aktivní fitness trenér s přístupem k datům ze Stravy. Můžeš:
- Analyzovat tréninky a výkony
- Doporučit trénink podle počasí a zdravotního stavu
- Sledovat zdravotní stav a únavu
- Pomoci s plánováním závodů
- Poskytovat sportovní rady

Máš k dispozici nástroje: get_strava_activities, get_health_logs, add_health_log, get_race_goals, add_race_goal
`;
    }

    // Systémový prompt podle režimu
    let systemPrompt = mode === "vera"
      ? `Jsi V.E.R.A. (Voice Enhanced Raspberry Assistant) - pokročilý hlasový asistent. Mluvíš česky, jsi přátelská a inteligentní. 
      
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
- create_calendar_event: Pro vytvoření události v Google Calendar - použij VŽDY když uživatel chce vytvořit událost/upomínku/schůzku
- list_calendar_events: Pro přečtení událostí z kalendáře na dnes/zítra/konkrétní datum

Když se uživatel ptá na plány (např. "co mám zítra", "co mám naplánováno"), použij get_notes_by_date nebo list_calendar_events. Pro sumár použij create_summary. Pro přeplánování použij reschedule_note. Pro odeslání emailem použij send_notes_email. Pro vytvoření události v kalendáři použij create_calendar_event.`
      : `Jsi M.A.R.K. (My Assistant Raspberry Kit) - základní hlasový asistent. Mluvíš česky a jsi jednoduchý a přímočarý.

DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

ANALÝZA FOTEK: Když uživatel pošle fotku, popiš co vidíš a pokud obsahuje něco důležitého (úkol, termín...), ulož to pomocí add_note.

VYTVÁŘENÍ KALENDÁŘNÍCH UDÁLOSTÍ: Když uživatel říká "vytvoř v kalendáři", "přidej do kalendáře", "naplánuj", "upomeň mě" nebo podobně, použij create_calendar_event.

Umíš spravovat poznámky pomocí nástrojů add_note, get_notes, delete_note, get_notes_by_date, create_summary, reschedule_note, send_notes_email, create_calendar_event, list_calendar_events. Když se uživatel ptá na plánované úkoly, použij get_notes_by_date nebo list_calendar_events. Pro odeslání emailem použij send_notes_email. Pro vytvoření události v kalendáři použij create_calendar_event.`;
    
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
    const calendarKeywords = [
      "vytvoř v kalendáři",
      "přidej do kalendáře",
      "naplánuj",
      "upomeň",
      "upomínku",
      "vytvoř událost",
      "přidej schůzku",
    ];
    const shouldForceCalendar = !!lastUserText && calendarKeywords.some(k => lastUserText.includes(k));
    console.log("AI tool_choice:", shouldForceCalendar ? "force:create_calendar_event" : "auto");

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
        tool_choice: shouldForceCalendar ? { type: "function", function: { name: "create_calendar_event" } } : "auto",
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
                    const stravaResp = await supabase.functions.invoke("get-strava-activities", {
                      headers: { Authorization: authHeader || "" },
                      body: { 
                        per_page: args.limit || 10,
                        before: args.before,
                        after: args.after
                      }
                    });

                    if (stravaResp.error) {
                      result = { error: stravaResp.error.message };
                    } else {
                      const activities = (stravaResp.data as any) || [];
                      if (activities.length === 0) {
                        result = { message: "Zatím nemáš žádné aktivity." };
                      } else {
                        const formatted = activities.map((act: any, i: number) => {
                          const date = new Date(act.start_date).toLocaleDateString("cs-CZ");
                          const distance = (act.distance / 1000).toFixed(2);
                          const time = Math.floor(act.moving_time / 60);
                          return `${i + 1}. ${act.name} (${act.type})\n   📅 ${date} | 📏 ${distance} km | ⏱️ ${time} min`;
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
