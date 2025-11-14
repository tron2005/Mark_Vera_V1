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
      console.error("Auth error:", userError);
      throw new Error("Unauthorized");
    }

    const { query, maxResults = 10, from, subject, after, before }: SearchGmailRequest = await req.json();

    // Get user's Google access token
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .single();

    if (!profile?.google_access_token) {
      throw new Error("Google účet není připojen");
    }

    // Check if token needs refresh
    let accessToken = profile.google_access_token;
    if (profile.google_token_expiry && new Date(profile.google_token_expiry) <= new Date()) {
      console.log("Google token expired, refreshing...");
      
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

      if (!refreshResponse.ok) {
        throw new Error("Failed to refresh Google token");
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
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

    console.log("Gmail search query:", searchQuery);

    // Search Gmail messages
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error("Gmail search error:", errorText);
      throw new Error("Chyba při vyhledávání v Gmailu");
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.messages || searchData.messages.length === 0) {
      return new Response(JSON.stringify({ messages: [], count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch full message details
    const messages = await Promise.all(
      searchData.messages.map(async (msg: any) => {
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) {
          console.error("Failed to fetch message:", msg.id);
          return null;
        }

        const msgData = await msgResponse.json();
        
        // Extract headers
        const headers = msgData.payload.headers;
        const getHeader = (name: string) => 
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        // Extract body
        let body = "";
        if (msgData.payload.body.data) {
          body = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (msgData.payload.parts) {
          // Try to find text/plain or text/html part
          for (const part of msgData.payload.parts) {
            if (part.mimeType === "text/plain" && part.body.data) {
              body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              break;
            }
          }
          // Fallback to first part with data
          if (!body) {
            for (const part of msgData.payload.parts) {
              if (part.body.data) {
                body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                break;
              }
            }
          }
        }

        // Truncate body to first 500 characters
        if (body.length > 500) {
          body = body.substring(0, 500) + "...";
        }

        return {
          id: msgData.id,
          threadId: msgData.threadId,
          from: getHeader("From"),
          to: getHeader("To"),
          subject: getHeader("Subject"),
          date: getHeader("Date"),
          snippet: msgData.snippet,
          body: body,
        };
      })
    );

    const validMessages = messages.filter(m => m !== null);

    console.log(`Found ${validMessages.length} messages`);

    return new Response(JSON.stringify({ 
      messages: validMessages,
      count: validMessages.length,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in search-gmail function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
