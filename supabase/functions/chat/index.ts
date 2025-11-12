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
      }
    ];

    // Systémový prompt podle režimu
    let systemPrompt = mode === "vera"
      ? `Jsi V.E.R.A. (Voice Enhanced Raspberry Assistant) - pokročilý hlasový asistent. Mluvíš česky, jsi přátelská a inteligentní. 
      
Umíš spravovat poznámky uživatele pomocí nástrojů:
- add_note: Pro uložení nové poznámky
- get_notes: Pro zobrazení poznámek
- delete_note: Pro smazání poznámky

Když uživatel řekne "zapiš poznámku" nebo "ulož poznámku", použij nástroj add_note. Když řekne "zobraz poznámky" nebo "co mám v poznámkách", použij get_notes. Pro smazání použij delete_note.`
      : `Jsi M.A.R.K. (My Assistant Raspberry Kit) - základní hlasový asistent. Mluvíš česky a jsi jednoduchý a přímočarý.

Umíš spravovat poznámky pomocí nástrojů add_note, get_notes, delete_note. Když tě uživatel požádá o uložení poznámky, použij add_note.`;
    
    if (customInstructions) {
      systemPrompt += `\n\nVlastní instrukce od uživatele: ${customInstructions}`;
    }

    console.log(`Chat request - mode: ${mode}, messages: ${messages.length}`);

    // Načíst celou historii konverzace z databáze
    let conversationHistory: any[] = [];
    if (conversationId) {
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      
      conversationHistory = dbMessages || [];
    }

    // Poslední zpráva od uživatele (z requestu)
    const lastUserMessage = messages[messages.length - 1]?.content || "";

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
          ...conversationHistory,
          { role: "user", content: lastUserMessage },
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
              ...conversationHistory,
              { role: "user", content: lastUserMessage },
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
