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
  const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
    throw new Error("Failed to refresh access token");
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
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

    // Create calendar event
    const startDateTime = new Date(start);
    const endDateTime = end ? new Date(end) : new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // Format as local Prague time without converting to UTC
    const formatPragueTime = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      const second = String(d.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    };

    const event = {
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
      console.error("Calendar API error:", errorText);
      throw new Error("Failed to create calendar event");
    }

    const createdEvent = await calendarResponse.json();

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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
