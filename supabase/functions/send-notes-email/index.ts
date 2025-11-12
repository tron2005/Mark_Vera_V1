import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Note {
  id: string;
  text: string;
  category?: string;
  due_date?: string;
  location?: string;
  is_important?: boolean;
  created_at: string;
}

interface SendEmailRequest {
  recipientEmail: string;
  type: "single" | "summary" | "filtered";
  noteId?: string;
  filterDate?: string;
  filterCategory?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    const { recipientEmail, type, noteId, filterDate, filterCategory }: SendEmailRequest = await req.json();

    console.log(`Sending ${type} email to ${recipientEmail}`);

    let notes: Note[] = [];
    let emailSubject = "";
    let emailContent = "";

    if (type === "single" && noteId) {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("id", noteId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        throw new Error("Poznámka nenalezena");
      }

      notes = [data];
      emailSubject = "Vaše poznámka z M.A.R.K./V.E.R.A.";
      emailContent = formatSingleNote(data);

    } else if (type === "summary") {
      let query = supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filterDate) {
        const startDate = new Date(filterDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filterDate);
        endDate.setHours(23, 59, 59, 999);
        
        query = query
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
      }

      if (filterCategory) {
        query = query.eq("category", filterCategory);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error("Chyba při načítání poznámek");
      }

      notes = data || [];
      
      if (filterDate) {
        emailSubject = `Sumář poznámek za ${new Date(filterDate).toLocaleDateString("cs-CZ")}`;
      } else if (filterCategory) {
        emailSubject = `Sumář poznámek - kategorie ${filterCategory}`;
      } else {
        emailSubject = "Sumář všech vašich poznámek";
      }
      
      emailContent = formatNotesSummary(notes, filterDate, filterCategory);
    }

    if (notes.length === 0) {
      throw new Error("Žádné poznámky k odeslání");
    }

    const emailResponse = await resend.emails.send({
      from: "M.A.R.K./V.E.R.A. <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: emailSubject,
      html: emailContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email odeslán na ${recipientEmail}`,
        emailId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-notes-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function formatSingleNote(note: Note): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
        📝 Poznámka z M.A.R.K./V.E.R.A.
      </h1>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="font-size: 16px; line-height: 1.6; color: #333;">
          ${note.text}
        </p>
        
        ${note.category ? `<p style="color: #666;"><strong>Kategorie:</strong> ${note.category}</p>` : ""}
        ${note.due_date ? `<p style="color: #666;"><strong>Termín:</strong> ${new Date(note.due_date).toLocaleString("cs-CZ")}</p>` : ""}
        ${note.location ? `<p style="color: #666;"><strong>Místo:</strong> ${note.location}</p>` : ""}
        ${note.is_important ? '<p style="color: #f44336;"><strong>⭐ Důležité</strong></p>' : ""}
        
        <p style="color: #999; font-size: 12px; margin-top: 15px;">
          Vytvořeno: ${new Date(note.created_at).toLocaleString("cs-CZ")}
        </p>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
        Tento email byl vygenerován vaším asistentem M.A.R.K./V.E.R.A.
      </p>
    </div>
  `;
}

function formatNotesSummary(notes: Note[], filterDate?: string, filterCategory?: string): string {
  const importantNotes = notes.filter(n => n.is_important);
  const upcomingNotes = notes.filter(n => n.due_date && new Date(n.due_date) > new Date());
  
  let filterInfo = "";
  if (filterDate) {
    filterInfo = `<p style="color: #666;">📅 Datum: ${new Date(filterDate).toLocaleDateString("cs-CZ")}</p>`;
  }
  if (filterCategory) {
    filterInfo += `<p style="color: #666;">🏷️ Kategorie: ${filterCategory}</p>`;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
        📊 Sumář poznámek z M.A.R.K./V.E.R.A.
      </h1>
      
      ${filterInfo}
      
      <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #1976d2; margin: 0 0 10px 0;">📈 Statistiky</h2>
        <p style="margin: 5px 0;">Celkem poznámek: <strong>${notes.length}</strong></p>
        <p style="margin: 5px 0;">Důležitých: <strong>${importantNotes.length}</strong></p>
        <p style="margin: 5px 0;">Nadcházejících úkolů: <strong>${upcomingNotes.length}</strong></p>
      </div>
      
      ${importantNotes.length > 0 ? `
        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <h2 style="color: #f57c00; margin: 0 0 15px 0;">⭐ Důležité poznámky</h2>
          ${importantNotes.map(note => `
            <div style="background: white; padding: 12px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="margin: 0; color: #333;">${note.text}</p>
              ${note.due_date ? `<p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">📅 ${new Date(note.due_date).toLocaleString("cs-CZ")}</p>` : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
      
      ${upcomingNotes.length > 0 ? `
        <div style="background: #f1f8e9; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8bc34a;">
          <h2 style="color: #689f38; margin: 0 0 15px 0;">📅 Nadcházející úkoly</h2>
          ${upcomingNotes.map(note => `
            <div style="background: white; padding: 12px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <p style="margin: 0; color: #333;">${note.text}</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">📅 ${new Date(note.due_date!).toLocaleString("cs-CZ")}</p>
            </div>
          `).join("")}
        </div>
      ` : ""}
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #333; margin: 0 0 15px 0;">📝 Všechny poznámky</h2>
        ${notes.map(note => `
          <div style="background: white; padding: 12px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <p style="margin: 0; color: #333; font-weight: ${note.is_important ? "bold" : "normal"};">
              ${note.is_important ? "⭐ " : ""}${note.text}
            </p>
            <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 12px; color: #666;">
              ${note.category ? `<span>🏷️ ${note.category}</span>` : ""}
              ${note.due_date ? `<span>📅 ${new Date(note.due_date).toLocaleString("cs-CZ")}</span>` : ""}
              ${note.location ? `<span>📍 ${note.location}</span>` : ""}
            </div>
            <p style="color: #999; font-size: 11px; margin: 5px 0 0 0;">
              Vytvořeno: ${new Date(note.created_at).toLocaleString("cs-CZ")}
            </p>
          </div>
        `).join("")}
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
        Tento email byl vygenerován vaším asistentem M.A.R.K./V.E.R.A.
      </p>
    </div>
  `;
}

serve(handler);
