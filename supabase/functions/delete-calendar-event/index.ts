import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteEventRequest {
    eventId: string;
    calendarId?: string; // Default 'primary'
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

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
        try { const errorData = JSON.parse(errorText); if (errorData.error === "invalid_grant") { errorMsg = "Google Calendar přístup vypršel. Prosím odpojte a znovu připojte Google Calendar v Nastavení."; } } catch (e) {}
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
        const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) throw new Error("Unauthorized");

        const { eventId, calendarId = "primary" }: DeleteEventRequest = await req.json();

        if (!eventId) throw new Error("Missing eventId");

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

        console.log(`Deleting event ${eventId} from calendar ${calendarId}`);

        const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!resp.ok) {
            const t = await resp.text();
            console.error("Calendar delete error:", t);
            // Determine if it was 404
            if (resp.status === 404 || resp.status === 410) { // 410 is Gone
                return new Response(JSON.stringify({ success: false, error: "Event not found or already deleted" }), {
                    status: 200, // Return 200 with error message strictly for client handling
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            throw new Error(`Failed to delete event: ${resp.statusText}`);
        }

        return new Response(JSON.stringify({ success: true, message: "Event deleted" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e: any) {
        console.error("Error in delete-calendar-event:", e);
        return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
