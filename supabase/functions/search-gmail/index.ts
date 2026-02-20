import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchGmailRequest {
  query?: string;
  maxResults?: number;
  from?: string;
  subject?: string;
  after?: string;
  before?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");

    // Limit maxResults to max 5 to avoid rate limits and long responses
    const { query, maxResults = 5, from, subject, after, before }: SearchGmailRequest = await req.json();
    const safeMax = Math.min(maxResults, 5);

    // Get user's Google access token
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (!profile?.google_access_token) throw new Error("Google účet není připojen");

    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    if (profile.google_token_expiry && new Date(profile.google_token_expiry) <= new Date()) {
      console.log("Refreshing Google token...");
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          refresh_token: profile.google_refresh_token!,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) throw new Error("Failed to refresh Google token");
      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;
      await supabase
        .from("profiles")
        .update({
          google_access_token: accessToken,
          google_token_expiry: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq("user_id", user.id);
    }

    // Build Gmail search query
    let searchQuery = query || "";
    if (from) searchQuery += ` from:${from}`;
    if (subject) searchQuery += ` subject:${subject}`;
    if (after) searchQuery += ` after:${after}`;
    if (before) searchQuery += ` before:${before}`;
    console.log("Gmail search query:", searchQuery, "maxResults:", safeMax);

    // Search Gmail messages (list only, no body)
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=${safeMax}`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Gmail search error:", errorText);
      // Handle rate limit specifically
      if (searchResponse.status === 429) {
        throw new Error("Gmail API přetížen, zkus to za chvíli znovu");
      }
      throw new Error("Chyba při vyhledávání v Gmailu");
    }

    const searchData = await searchResponse.json();
    if (!searchData.messages || searchData.messages.length === 0) {
      return new Response(JSON.stringify({ messages: [], count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch message METADATA only (only headers, no body) – much faster, avoids rate limits
    // Sequential with small delay to avoid hitting rate limits
    const messages: any[] = [];
    for (const msg of searchData.messages) {
      try {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) {
          console.error("Failed to fetch message metadata:", msg.id, msgResponse.status);
          // On rate limit, stop fetching more
          if (msgResponse.status === 429) {
            console.log("Rate limit hit, stopping early");
            break;
          }
          continue;
        }

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        messages.push({
          id: msgData.id,
          from: getHeader("From"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: msgData.snippet ? msgData.snippet.substring(0, 120) : "",
        });

        // Small delay between requests to avoid rate limiting
        if (messages.length < searchData.messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (e) {
        console.error("Error fetching message:", e);
        continue;
      }
    }

    console.log(`Found ${messages.length} messages`);
    return new Response(JSON.stringify({ messages, count: messages.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in search-gmail function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
