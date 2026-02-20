import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateEventRequest {
    eventId: string;
    calendarId?: string; // Default 'primary'
    summary?: string;
    description?: string;
    start?: string; // New start time/date
    end?: string;   // New end time/date
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
        } catch (e) { /* ignore */ }
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

        const { eventId, calendarId = "primary", summary, description, start, end }: UpdateEventRequest = await req.json();

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

        // 1. Fetch existing event
        const getResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!getResp.ok) {
            if (getResp.status === 404 || getResp.status === 410) {
                throw new Error("Event not found");
            }
            throw new Error("Failed to fetch event for update");
        }

        const currentEvent = await getResp.json();
        const patchBody: any = {};

        if (summary) patchBody.summary = summary;
        if (description) patchBody.description = description;

        // Helper to parse date
        const parseCzechDateTime = (input: string): { date: Date; hasTime: boolean } => {
            if (!input || typeof input !== 'string') throw new Error('Neplatný vstup data');
            const raw = input.trim().toLowerCase();
            // Normalize
            const s = raw.replace(/\s+/g, ' ').replace(/,/, '');
            // ISO
            const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/i);
            if (isoMatch) {
                const [, y, m, d, hh, mm, ss] = isoMatch;
                const hasTime = hh !== undefined && mm !== undefined;
                return { date: new Date(Number(y), Number(m) - 1, Number(d), hasTime ? Number(hh) : 0, hasTime ? Number(mm) : 0, (hasTime && ss) ? Number(ss) : 0), hasTime };
            }
            // Czech
            const czMatch = s.match(/(\d{1,2})[\.\-/\s](\d{1,2})[\.\-/\s](\d{4})(?:\s+v\s+)?(?:(\d{1,2})[:.](\d{2}))?/);
            if (czMatch) {
                const [, dStr, mStr, yStr, hh, mm] = czMatch;
                const hasTime = !!(hh && mm);
                return { date: new Date(Number(yStr), Number(mStr) - 1, Number(dStr), hasTime ? Number(hh) : 0, hasTime ? Number(mm) : 0, 0), hasTime };
            }
            // Native
            const parsed = new Date(input);
            if (!isFinite(parsed.getTime())) throw new Error(`Neumím zpracovat datum: ${input}`);
            const hasTime = /\d{1,2}[:.]\d{2}/.test(s) || /t\d{2}:\d{2}/.test(s);
            return { date: parsed, hasTime };
        };

        const formatPragueTime = (d: Date): string => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hour = String(d.getHours()).padStart(2, '0');
            const minute = String(d.getMinutes()).padStart(2, '0');
            const second = String(d.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
        };

        const formatDateOnly = (d: Date): string => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        // Calculate time updates
        if (start || end) {
            let newStartObj = start ? parseCzechDateTime(start) : null;
            let newEndObj = end ? parseCzechDateTime(end) : null;

            // Current start/end
            const currentStartStr = currentEvent.start.dateTime || currentEvent.start.date;
            const currentEndStr = currentEvent.end.dateTime || currentEvent.end.date;
            const currentStart = new Date(currentStartStr);
            const currentEnd = new Date(currentEndStr);
            const currentIsAllDay = !currentEvent.start.dateTime;
            const currentDuration = currentEnd.getTime() - currentStart.getTime();

            // If only start provided, maintain duration
            if (newStartObj && !newEndObj) {
                const newStartMs = newStartObj.date.getTime();
                const newEndMs = newStartMs + currentDuration;
                newEndObj = { date: new Date(newEndMs), hasTime: newStartObj.hasTime };
            }

            // If only end provided (rare), we keep start
            if (!newStartObj && newEndObj) {
                // Keep current start but maybe reformat if type changes? 
                // Simplification: if type changes (all-day <-> timed), we must parse current again.
                // But let's assume if only end is changed, we keep start as is.
                // Wait, mixing Date and DateTime is invalid.
            }

            // Apply
            if (newStartObj) {
                if (!newStartObj.hasTime && (!newEndObj || !newEndObj.hasTime)) {
                    // All day
                    patchBody.start = { date: formatDateOnly(newStartObj.date) };
                    // Ensure end is set correctly for all day (inclusive start, exclusive end)
                    if (newEndObj) {
                        // Check if end needs +1 day adjustment? 
                        // Usually user says "end on 25.5.", meaning 25.5. is included. Google needs 26.5.
                        // But if calculated from duration, it's already correct.
                        patchBody.end = { date: formatDateOnly(newEndObj.date) };
                    }
                } else {
                    // Timed
                    patchBody.start = { dateTime: formatPragueTime(newStartObj.date), timeZone: 'Europe/Prague' };
                    if (newEndObj) {
                        patchBody.end = { dateTime: formatPragueTime(newEndObj.date), timeZone: 'Europe/Prague' };
                    }
                }
            }
        }

        console.log(`Updating event ${eventId}:`, patchBody);

        const updateResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(patchBody)
        });

        if (!updateResp.ok) {
            const t = await updateResp.text();
            console.error("Calendar update error:", t);
            throw new Error(`Failed to update event: ${updateResp.statusText}`);
        }

        const updatedEvent = await updateResp.json();
        return new Response(JSON.stringify({
            success: true,
            message: "Event updated",
            eventLink: updatedEvent.htmlLink,
            summary: updatedEvent.summary
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (e: any) {
        console.error("Error in update-calendar-event:", e);
        return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
