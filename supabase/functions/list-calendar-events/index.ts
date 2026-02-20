import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ListRequest {
  date?: string; // YYYY-MM-DD
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!googleClientId || !googleClientSecret) {
    console.error("Missing Google OAuth credentials in environment");
    throw new Error("Google Calendar není správně nakonfigurován. Kontaktujte administrátora.");
  }

  console.log("Refreshing Google access token...");

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
    console.error("Google token refresh failed:", response.status, errorText);

    let errorMsg = "Nepodařilo se obnovit přístup ke Google Calendar.";
    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error === "invalid_grant") {
        errorMsg = "Google Calendar přístup vypršel. Prosím odpojte a znovu připojte Google Calendar v Nastavení.";
      }
    } catch (e) {
      // ignore parse error
    }

    throw new Error(errorMsg);
  }

  const data = await response.json();
  console.log("Google access token refreshed successfully");
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    const { date }: ListRequest = await req.json();

    // Get tokens
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
      await supabase.from("profiles").update({ google_access_token: newToken, google_token_expiry: newExpiry.toISOString() }).eq("user_id", user.id);
    }

    // Compute timeMin/timeMax for the requested day in Prague TZ
    const tz = "Europe/Prague";
    const base = date ? new Date(`${date}T00:00:00`) : new Date();
    const startOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
    const endOfDay = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59);

    const listResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(startOfDay.toISOString())}&timeMax=${encodeURIComponent(endOfDay.toISOString())}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResp.ok) {
      const t = await listResp.text();
      console.error("Calendar list error:", t);
      throw new Error("Failed to list calendar events");
    }

    const data = await listResp.json();

    return new Response(JSON.stringify({ success: true, items: data.items || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Error in list-calendar-events:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});