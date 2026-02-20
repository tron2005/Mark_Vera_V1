import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateEventRequest {
  summary: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { summary, start, end, location, description }: CreateEventRequest = await req.json();

    // Get user's Google tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Google Calendar není připojen");
    }

    let accessToken = profile.google_access_token;
    const tokenExpiry = profile.google_token_expiry ? new Date(profile.google_token_expiry) : null;
    const now = new Date();

    // Refresh token if expired
    if (!tokenExpiry || now >= tokenExpiry) {
      if (!profile.google_refresh_token) {
        throw new Error("Google Calendar není připojen - chybí refresh token");
      }

      const { accessToken: newAccessToken, expiresIn } = await refreshAccessToken(
        profile.google_refresh_token
      );
      
      accessToken = newAccessToken;
      const newExpiry = new Date();
      newExpiry.setSeconds(newExpiry.getSeconds() + expiresIn);

      // Update profile with new access token
      await supabase
        .from("profiles")
        .update({
          google_access_token: newAccessToken,
          google_token_expiry: newExpiry.toISOString(),
        })
        .eq("user_id", user.id);
    }

    console.log("Creating calendar event:", { summary, start, end, location });
    
    // Create calendar event
    // Robustly parse Czech/ISO date strings, optionally with time
    const parseCzechDateTime = (input: string): { date: Date; hasTime: boolean } => {
      if (!input || typeof input !== 'string') throw new Error('Neplatný vstup data');
      const raw = input.trim().toLowerCase();

      // Normalize spaces
      const s = raw.replace(/\s+/g, ' ').replace(/,/, '');

      // ISO like 2025-04-26 or 2025-04-26T10:00
      const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/i);
      if (isoMatch) {
        const [, y, m, d, hh, mm, ss] = isoMatch;
        const year = Number(y), month = Number(m) - 1, day = Number(d);
        const hasTime = hh !== undefined && mm !== undefined;
        const hours = hasTime ? Number(hh) : 0;
        const minutes = hasTime ? Number(mm) : 0;
        const seconds = hasTime && ss ? Number(ss) : 0;
        // Construct as local Europe/Prague time; Google API will use provided timeZone
        return { date: new Date(year, month, day, hours, minutes, seconds), hasTime };
      }

      // Czech formats: 26. 4. 2025, 26.4.2025, 26/4/2025
      const czMatch = s.match(/(\d{1,2})[\.\-/\s](\d{1,2})[\.\-/\s](\d{4})(?:\s+v\s+)?(?:(\d{1,2})[:.](\d{2}))?/);
      if (czMatch) {
        const [, dStr, mStr, yStr, hh, mm] = czMatch;
        const day = Number(dStr), month = Number(mStr) - 1, year = Number(yStr);
        const hasTime = !!(hh && mm);
        const hours = hasTime ? Number(hh) : 0;
        const minutes = hasTime ? Number(mm) : 0;
        return { date: new Date(year, month, day, hours, minutes, 0), hasTime };
      }

      // Fallback to native parsing as last resort
      const parsed = new Date(input);
      if (!isFinite(parsed.getTime())) throw new Error(`Neumím zpracovat datum: ${input}`);
      // Heuristic: contains time?
      const hasTime = /\d{1,2}[:.]\d{2}/.test(s) || /t\d{2}:\d{2}/.test(s);
      return { date: parsed, hasTime };
    };

    const { date: startDateTime, hasTime: startHasTime } = parseCzechDateTime(start);

    // Decide all-day by presence of explicit time in input
    const isAllDay = !startHasTime;

    let event: any;

    if (isAllDay) {
      // For all-day events, use date format (YYYY-MM-DD) without time
      const formatDate = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      let endDate: Date;
      if (end) {
        const { date: endParsed } = parseCzechDateTime(end);
        endDate = endParsed;
      } else {
        endDate = new Date(startDateTime);
      }
      // For all-day events, end date is exclusive, so add 1 day
      endDate.setDate(endDate.getDate() + 1);

      event = {
        summary,
        location,
        description,
        start: {
          date: formatDate(startDateTime),
          timeZone: "Europe/Prague",
        },
        end: {
          date: formatDate(endDate),
          timeZone: "Europe/Prague",
        },
      };
      console.log("Creating all-day event:", event);
    } else {
      // For timed events, use dateTime format
      let endDateTime: Date;
      if (end) {
        const { date: endParsed } = parseCzechDateTime(end);
        endDateTime = endParsed;
      } else {
        endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      }

      const formatPragueTime = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hour = String(d.getHours()).padStart(2, '0');
        const minute = String(d.getMinutes()).padStart(2, '0');
        const second = String(d.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      };

      event = {
        summary,
        location,
        description,
        start: {
          dateTime: formatPragueTime(startDateTime),
          timeZone: "Europe/Prague",
        },
        end: {
          dateTime: formatPragueTime(endDateTime),
          timeZone: "Europe/Prague",
        },
      };
      console.log("Creating timed event:", event);
    }

    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Calendar API error:", calendarResponse.status, errorText);
      let errorMessage = "Failed to create calendar event";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // If not JSON, use raw text
        if (errorText.length < 200) {
          errorMessage = errorText;
        }
      }
      throw new Error(`Google Calendar API chyba: ${errorMessage}`);
    }

    const createdEvent = await calendarResponse.json();
    console.log("Calendar event created successfully:", { 
      id: createdEvent.id, 
      summary: createdEvent.summary,
      start: createdEvent.start,
      link: createdEvent.htmlLink 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Událost vytvořena v Google Calendar",
        eventId: createdEvent.id,
        eventLink: createdEvent.htmlLink,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-calendar-event:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
