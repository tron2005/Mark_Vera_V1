import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query?: string;       // Textový dotaz (hledá v názvu, popisu, místě)
  timeMin?: string;     // ISO datum od (výchozí: dnes)
  timeMax?: string;     // ISO datum do (výchozí: +6 měsíců)
  maxResults?: number;  // Max počet výsledků (výchozí: 10)
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google Calendar není správně nakonfigurován. Kontaktujte administrátora.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = "Nepodařilo se obnovit přístup ke Google Calendar.";
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error === "invalid_grant") {
        errorMsg = "Google Calendar přístup vypršel. Prosím odpojte a znovu připojte Google Calendar v Nastavení.";
      }
    } catch (_) { /* ignore */ }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { query, timeMin, timeMax, maxResults = 10 }: SearchRequest = await req.json();

    // Načíst tokeny
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Google Calendar není připojen");

    let accessToken = profile.google_access_token as string | null;
    const tokenExpiry = profile.google_token_expiry ? new Date(profile.google_token_expiry) : null;
    const now = new Date();

    if (!tokenExpiry || now >= tokenExpiry) {
      if (!profile.google_refresh_token) throw new Error("Chybí refresh token");
      const { accessToken: newToken, expiresIn } = await refreshAccessToken(profile.google_refresh_token);
      accessToken = newToken;
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + expiresIn);
      await supabase
        .from("profiles")
        .update({ google_access_token: newToken, google_token_expiry: newExpiry.toISOString() })
        .eq("user_id", user.id);
    }

    // Sestavit URL pro Google Calendar search
    const searchFrom = timeMin ? new Date(timeMin) : new Date();
    const searchTo = timeMax ? new Date(timeMax) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 6);
      return d;
    })();

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin: searchFrom.toISOString(),
      timeMax: searchTo.toISOString(),
      maxResults: String(Math.min(maxResults, 50)),
    });

    if (query && query.trim()) {
      params.set("q", query.trim());
    }

    const listResp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!listResp.ok) {
      const t = await listResp.text();
      console.error("Calendar search error:", t);
      throw new Error("Nepodařilo se vyhledat události v Google Calendar");
    }

    const data = await listResp.json();
    const items = data.items || [];

    return new Response(
      JSON.stringify({ success: true, items, total: items.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Error in search-calendar-events:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
