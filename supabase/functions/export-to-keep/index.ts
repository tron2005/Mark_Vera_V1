import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  noteIds?: string[];
  exportAll?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { noteIds, exportAll }: ExportRequest = await req.json();

    // Získat profil uživatele s Google tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.google_refresh_token) {
      return new Response(
        JSON.stringify({ error: "Google není připojen. Připojte Google Calendar v nastavení." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh access token pokud je potřeba
    let accessToken = profile.google_access_token;
    const tokenExpiry = profile.google_token_expiry ? new Date(profile.google_token_expiry) : new Date(0);
    
    if (!accessToken || tokenExpiry < new Date()) {
      console.log("Refreshing Google access token...");
      const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: profile.google_refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error("Nepodařilo se obnovit Google přístup");
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      const expiresIn = refreshData.expires_in || 3600;

      await supabase
        .from("profiles")
        .update({
          google_access_token: accessToken,
          google_token_expiry: new Date(Date.now() + expiresIn * 1000).toISOString(),
        })
        .eq("user_id", user.id);
    }

    // Získat poznámky k exportu
    let query = supabase
      .from("notes")
      .select("*")
      .eq("user_id", user.id);

    if (!exportAll && noteIds && noteIds.length > 0) {
      query = query.in("id", noteIds);
    }

    const { data: notes, error: notesError } = await query;

    if (notesError || !notes || notes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Žádné poznámky k exportu" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Najít nebo vytvořit task list "M.A.R.K./V.E.R.A. Poznámky"
    const taskListsResponse = await fetch(
      "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!taskListsResponse.ok) {
      throw new Error("Nepodařilo se načíst Google Tasks seznamy");
    }

    const taskListsData = await taskListsResponse.json();
    let taskListId = taskListsData.items?.find(
      (list: any) => list.title === "M.A.R.K./V.E.R.A. Poznámky"
    )?.id;

    // Vytvořit nový task list pokud neexistuje
    if (!taskListId) {
      const createListResponse = await fetch(
        "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "M.A.R.K./V.E.R.A. Poznámky",
          }),
        }
      );

      if (!createListResponse.ok) {
        throw new Error("Nepodařilo se vytvořit Google Tasks seznam");
      }

      const newList = await createListResponse.json();
      taskListId = newList.id;
    }

    // Exportovat každou poznámku jako task
    let successCount = 0;
    let errorCount = 0;

    for (const note of notes) {
      const taskBody: any = {
        title: note.text,
        notes: `Kategorie: ${note.category}\n` +
               (note.location ? `Místo: ${note.location}\n` : "") +
               (note.recurrence ? `Opakování: ${note.recurrence}\n` : "") +
               `Vytvořeno: ${new Date(note.created_at).toLocaleString("cs-CZ")}`,
      };

      if (note.due_date) {
        taskBody.due = new Date(note.due_date).toISOString();
      }

      const createTaskResponse = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskBody),
        }
      );

      if (createTaskResponse.ok) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Nepodařilo se exportovat poznámku ${note.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        exported: successCount,
        failed: errorCount,
        message: `Exportováno ${successCount} poznámek do Google Tasks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Chyba při exportu do Keep:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Nepodařilo se exportovat poznámky" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
