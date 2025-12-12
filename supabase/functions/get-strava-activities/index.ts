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

    // Get user's email for tester lookup
    const userEmail = user.email;
    
    // First check if user has custom Strava credentials in strava_testers
    let stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
    let stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    
    const { data: testerConfig } = await supabase
      .from("strava_testers")
      .select("strava_client_id, strava_client_secret")
      .eq("tester_email", userEmail)
      .eq("is_active", true)
      .maybeSingle();
    
    if (testerConfig?.strava_client_id && testerConfig?.strava_client_secret) {
      console.log("Using custom Strava credentials for tester:", userEmail);
      stravaClientId = testerConfig.strava_client_id;
      stravaClientSecret = testerConfig.strava_client_secret;
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

    // Fetch athlete profile for weight, age, etc.
    const athleteResponse = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (athleteResponse.ok) {
      const athleteData = await athleteResponse.json();
      console.log("Fetched athlete profile, weight:", athleteData.weight);
      
      // Update profile with weight if available
      const updateData: any = {};
      if (athleteData.weight) updateData.weight_kg = athleteData.weight;

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("profiles")
          .update(updateData)
          .eq("user_id", user.id);
      }
    }

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
      
      // Parse error and check for rate limit
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message === "Rate Limit Exceeded" || activitiesResponse.status === 429) {
          return new Response(
            JSON.stringify({ 
              error: "Strava API rate limit překročen. Zkuste to prosím za 15 minut.",
              rateLimitExceeded: true
            }),
            { 
              status: 429, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
      } catch (e) {
        // Error není JSON, pokračuj s obecnou chybou
      }
      
      throw new Error("Failed to fetch Strava activities");
    }

    const activities = await activitiesResponse.json();
    console.log("Strava activities count:", Array.isArray(activities) ? activities.length : "n/a", "first:", Array.isArray(activities) && activities[0]?.start_date);

    // Fetch detailed info for each activity to get heart rate and calories
    const detailedActivities = await Promise.all(
      (Array.isArray(activities) ? activities : []).map(async (activity: any) => {
        try {
          const detailResponse = await fetch(
            `https://www.strava.com/api/v3/activities/${activity.id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return {
              ...activity,
              average_heartrate: detailData.average_heartrate,
              max_heartrate: detailData.max_heartrate,
              calories: detailData.calories,
              kilojoules: detailData.kilojoules,
            };
          }
          return activity;
        } catch (err) {
          console.error(`Failed to fetch detail for activity ${activity.id}:`, err);
          return activity;
        }
      })
    );

    console.log("Enriched", detailedActivities.length, "activities with HR and calories");

    // Store activities in database
    const userId = user.id;
    if (detailedActivities.length > 0) {
      const activitiesToStore = detailedActivities.map((activity: any) => ({
        id: activity.id,
        user_id: userId,
        name: activity.name,
        activity_type: activity.type,
        start_date: activity.start_date,
        distance_meters: activity.distance,
        moving_time_seconds: activity.moving_time,
        elapsed_time_seconds: activity.elapsed_time,
        total_elevation_gain: activity.total_elevation_gain,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        calories: activity.calories,
        average_watts: activity.average_watts,
        max_watts: activity.max_watts,
        suffer_score: activity.suffer_score,
        raw_data: activity
      }));

      const { error: insertError } = await supabase
        .from('strava_activities')
        .upsert(activitiesToStore, {
          onConflict: 'user_id,id',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error('Error storing Strava activities:', insertError);
      } else {
        console.log(`Stored ${detailedActivities.length} activities in database`);
        
        // Update sync log
        const { error: syncError } = await supabase
          .from('strava_sync_log')
          .upsert({
            user_id: userId,
            last_sync_at: new Date().toISOString(),
            activities_synced: detailedActivities.length
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          });

        if (syncError) {
          console.error('Error updating sync log:', syncError);
        }
      }
    }

    return new Response(JSON.stringify({ activities: detailedActivities, synced: true }), {
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
