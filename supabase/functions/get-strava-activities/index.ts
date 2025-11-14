import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Failed to get user");
    }

    // Get user's Strava tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("strava_access_token, strava_refresh_token, strava_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Failed to get user profile");
    }

    if (!profile.strava_access_token) {
      throw new Error("Strava not connected");
    }

    let accessToken = profile.strava_access_token;

    // Check if token needs refresh
    if (profile.strava_token_expiry) {
      const expiryDate = new Date(profile.strava_token_expiry);
      const now = new Date();

      if (now >= expiryDate) {
        console.log("Refreshing Strava access token");

        const stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
        const stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

        const refreshResponse = await fetch("https://www.strava.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: stravaClientId,
            client_secret: stravaClientSecret,
            refresh_token: profile.strava_refresh_token,
            grant_type: "refresh_token",
          }),
        });

        if (!refreshResponse.ok) {
          throw new Error("Failed to refresh Strava token");
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;

        const newExpiryDate = new Date(Date.now() + refreshData.expires_in * 1000);

        await supabase
          .from("profiles")
          .update({
            strava_access_token: refreshData.access_token,
            strava_refresh_token: refreshData.refresh_token,
            strava_token_expiry: newExpiryDate.toISOString(),
          })
          .eq("user_id", user.id);
      }
    }

    // Get request parameters
    let { before, after, page = 1, per_page = 30 } = await req.json();

    // Normalize timestamps to seconds (Strava expects epoch seconds)
    const toSeconds = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return n > 1_000_000_000_000 ? Math.floor(n / 1000) : Math.floor(n);
    };
    const beforeSec = toSeconds(before);
    const afterSec = toSeconds(after);

    console.log("get-strava-activities params:", { page, per_page, before: beforeSec, after: afterSec });

    // Build query parameters
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(per_page),
    });

    if (beforeSec !== null) params.append("before", String(beforeSec));
    if (afterSec !== null) params.append("after", String(afterSec));

    const url = `https://www.strava.com/api/v3/athlete/activities?${params.toString()}`;
    console.log("Strava fetch URL:", url);

    // Fetch activities from Strava
    const activitiesResponse = await fetch(
      url,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!activitiesResponse.ok) {
      const errorText = await activitiesResponse.text();
      console.error("Strava API error:", errorText);
      throw new Error("Failed to fetch Strava activities");
    }

    const activities = await activitiesResponse.json();
    console.log("Strava activities count:", Array.isArray(activities) ? activities.length : "n/a", "first:", Array.isArray(activities) && activities[0]?.start_date);

    return new Response(JSON.stringify({ activities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-strava-activities:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
