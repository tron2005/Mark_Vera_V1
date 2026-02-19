import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StravaActivity {
    id: number;
    name: string;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    average_speed: number;
    max_speed: number;
    average_heartrate?: number;
    max_heartrate?: number;
    calories?: number;
    suffer_score?: number;
}

async function refreshStravaToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_at: number }> {
    const response = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Strava token refresh failed:", errorText);
        throw new Error("Failed to refresh Strava token");
    }

    return await response.json();
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        console.log("get-strava-activities: auth header present:", !!authHeader);

        if (!authHeader) {
            throw new Error("No authorization header");
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Create client with user's JWT to get user info
        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: authHeader },
            },
        });

        const {
            data: { user },
            error: userError,
        } = await supabaseUser.auth.getUser();

        console.log("getUser result:", { userId: user?.id, error: userError?.message });

        if (userError || !user) {
            throw new Error(`Failed to get user: ${userError?.message || "No user"}`);
        }

        // Use service role client for DB operations (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Get user's Strava tokens from profile
        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("strava_access_token, strava_refresh_token, strava_token_expiry, email")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError || !profile) {
            console.error("Profile error:", profileError);
            throw new Error("Failed to get user profile");
        }

        if (!profile.strava_refresh_token) {
            throw new Error("Strava is not connected. Please connect Strava first.");
        }

        // Check if user has custom Strava credentials
        let stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
        let stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

        console.log("Strava credentials:", {
            clientId: stravaClientId ? "set" : "missing",
            clientSecret: stravaClientSecret ? "set" : "missing",
        });

        const { data: testerConfig } = await supabaseAdmin
            .from("strava_testers")
            .select("strava_client_id, strava_client_secret")
            .eq("tester_email", profile.email)
            .eq("is_active", true)
            .maybeSingle();

        if (testerConfig?.strava_client_id && testerConfig?.strava_client_secret) {
            console.log("Using custom Strava credentials for tester:", profile.email);
            stravaClientId = testerConfig.strava_client_id;
            stravaClientSecret = testerConfig.strava_client_secret;
        }

        if (!stravaClientId || !stravaClientSecret) {
            throw new Error("Strava credentials not configured");
        }

        // Check if token is expired and refresh if needed
        let accessToken = profile.strava_access_token;
        const tokenExpiry = profile.strava_token_expiry
            ? new Date(profile.strava_token_expiry)
            : new Date(0);

        if (tokenExpiry <= new Date()) {
            console.log("Strava token expired, refreshing...");
            const newTokens = await refreshStravaToken(
                profile.strava_refresh_token,
                stravaClientId,
                stravaClientSecret
            );

            accessToken = newTokens.access_token;
            const newExpiry = new Date(newTokens.expires_at * 1000);

            // Update tokens in database using admin client
            await supabaseAdmin
                .from("profiles")
                .update({
                    strava_access_token: newTokens.access_token,
                    strava_refresh_token: newTokens.refresh_token,
                    strava_token_expiry: newExpiry.toISOString(),
                })
                .eq("user_id", user.id);

            console.log("Strava token refreshed successfully");
        }

        // First, verify the token works by getting the athlete profile
        console.log("Verifying Strava access token...");
        const athleteResponse = await fetch("https://www.strava.com/api/v3/athlete", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!athleteResponse.ok) {
            const athleteErrorText = await athleteResponse.text();
            console.error(`Strava athlete check failed (${athleteResponse.status}):`, athleteErrorText);
            throw new Error(`Strava token invalid (${athleteResponse.status}). Try reconnecting Strava.`);
        }

        const athlete = await athleteResponse.json();
        console.log("Strava athlete verified:", {
            id: athlete.id,
            username: athlete.username,
            firstname: athlete.firstname,
        });

        // Fetch activities from Strava API (last 90 days, up to 200)
        const ninetyDaysAgo = Math.floor(
            (Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000
        );

        const stravaUrl = `https://www.strava.com/api/v3/athlete/activities?after=${ninetyDaysAgo}&per_page=200`;
        console.log("Fetching Strava activities from URL:", stravaUrl);
        console.log("Since:", new Date(ninetyDaysAgo * 1000).toISOString());

        const activitiesResponse = await fetch(stravaUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!activitiesResponse.ok) {
            const status = activitiesResponse.status;
            const errorText = await activitiesResponse.text();
            console.error(`Strava API error (${status}):`, errorText);

            if (status === 429) {
                return new Response(
                    JSON.stringify({
                        error: "Strava API rate limit překročen. Zkuste to prosím za 15 minut.",
                        rateLimitExceeded: true,
                    }),
                    {
                        status: 429,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }

            throw new Error(`Strava API error: ${status} - ${errorText}`);
        }

        const activities: StravaActivity[] = await activitiesResponse.json();
        console.log(`Fetched ${activities.length} activities from Strava`);

        // Upsert activities into database using admin client
        let savedCount = 0;
        const savedActivities: any[] = [];

        for (const activity of activities) {
            const activityData = {
                id: activity.id,
                user_id: user.id,
                name: activity.name,
                activity_type: activity.type || activity.sport_type,
                start_date: activity.start_date,
                distance_meters: activity.distance,
                moving_time_seconds: activity.moving_time,
                elapsed_time_seconds: activity.elapsed_time,
                total_elevation_gain: activity.total_elevation_gain,
                average_speed: activity.average_speed,
                max_speed: activity.max_speed,
                average_heartrate: activity.average_heartrate || null,
                max_heartrate: activity.max_heartrate || null,
                calories: activity.calories || null,
                suffer_score: activity.suffer_score || null,
            };

            const { error: upsertError } = await supabaseAdmin
                .from("strava_activities")
                .upsert(activityData, { onConflict: "user_id,id" });

            if (upsertError) {
                console.error(`Error upserting activity ${activity.id}:`, upsertError);
            } else {
                savedCount++;
                savedActivities.push(activityData);
            }
        }

        // Log the sync using admin client
        await supabaseAdmin.from("strava_sync_log").upsert(
            {
                user_id: user.id,
                activities_synced: savedCount,
                status: "success",
                last_sync_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

        console.log(`Saved ${savedCount}/${activities.length} activities to database`);

        // Return in the format the frontend expects: { synced: true, activities: [...] }
        return new Response(
            JSON.stringify({
                synced: true,
                success: true,
                activities: savedActivities,
                activitiesCount: activities.length,
                savedCount,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error in get-strava-activities:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
