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
    const { code } = await req.json();
    console.log("Strava OAuth callback received code:", code ? "yes" : "no");

    if (!code) {
      throw new Error("Missing authorization code");
    }

    // Get user from authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

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

    console.log("getUser result:", {
      userId: user?.id,
      email: user?.email,
      error: userError?.message,
    });

    if (userError || !user) {
      throw new Error(`Failed to get user: ${userError?.message || "No user returned"}`);
    }

    // Use service role client for DB operations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has custom Strava credentials
    let stravaClientId = Deno.env.get("STRAVA_CLIENT_ID");
    let stravaClientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");

    console.log("Default Strava credentials:", {
      clientId: stravaClientId ? "set" : "missing",
      clientSecret: stravaClientSecret ? "set" : "missing",
    });

    const userEmail = user.email;
    const { data: testerConfig } = await supabaseAdmin
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

    if (!stravaClientId || !stravaClientSecret) {
      throw new Error("Strava credentials not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Supabase secrets.");
    }

    // Exchange code for tokens
    console.log("Exchanging code for tokens with Strava...");
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    const tokenResponseText = await tokenResponse.text();
    console.log("Strava token response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error("Strava token exchange failed:", tokenResponseText);
      throw new Error(`Failed to exchange Strava authorization code (${tokenResponse.status})`);
    }

    const tokenData = JSON.parse(tokenResponseText);
    console.log("Strava tokens obtained successfully for athlete:", tokenData.athlete?.username);

    // Calculate token expiry
    const expiryDate = new Date(tokenData.expires_at * 1000);

    // Store tokens in profiles table using admin client
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expiry: expiryDate.toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to store Strava tokens:", updateError);
      throw new Error("Failed to store Strava tokens: " + updateError.message);
    }

    console.log("Strava tokens stored successfully for user:", user.id);

    return new Response(
      JSON.stringify({ success: true, athlete: tokenData.athlete }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in strava-auth-callback:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
