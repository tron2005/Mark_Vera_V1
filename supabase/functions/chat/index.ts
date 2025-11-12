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

    // Načíst vlastní instrukce z profilu uživatele
    const { data: profile } = await supabase
      .from("profiles")
      .select("custom_instructions")
      .eq("user_id", userId)
      .maybeSingle();

    const customInstructions = profile?.custom_instructions || "";

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
      }
    ];

    // Systémový prompt podle režimu
    let systemPrompt = mode === "vera"
      ? `Jsi V.E.R.A. (Voice Enhanced Raspberry Assistant) - pokročilý hlasový asistent. Mluvíš česky, jsi přátelská a inteligentní. 
      
DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

Umíš spravovat poznámky uživatele pomocí nástrojů:
- add_note: Pro uložení nové poznámky (s možností nastavit termín dokončení, místo, upomínku a opakování)
- get_notes: Pro zobrazení poznámek
- delete_note: Pro smazání poznámky
- get_notes_by_date: Pro zobrazení poznámek s termínem na konkrétní den (např. "co mám zítra", "co mám tento týden")
- create_summary: Pro vytvoření sumáru poznámek
- reschedule_note: Pro přeplánování poznámky na jiný termín

Když se uživatel ptá na plány (např. "co mám zítra", "co mám naplánováno"), použij get_notes_by_date. Pro sumár použij create_summary. Pro přeplánování použij reschedule_note.`
      : `Jsi M.A.R.K. (My Assistant Raspberry Kit) - základní hlasový asistent. Mluvíš česky a jsi jednoduchý a přímočarý.

DŮLEŽITÉ: Máš přístup k celé historii této konverzace. Když se uživatel ptá "o čem jsme si říkali", "co jsme dnes řešili" nebo podobně, odkaž se na předchozí zprávy v této konverzaci. Pamatuješ si vše, o čem jste spolu mluvili.

ANALÝZA FOTEK: Když uživatel pošle fotku, popiš co vidíš a pokud obsahuje něco důležitého (úkol, termín...), ulož to pomocí add_note.

Umíš spravovat poznámky pomocí nástrojů add_note, get_notes, delete_note, get_notes_by_date, create_summary, reschedule_note. Když se uživatel ptá na plánované úkoly, použij get_notes_by_date.`;
    
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
