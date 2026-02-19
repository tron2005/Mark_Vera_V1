import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Zpracovávám Strava připojení...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      console.log("StravaCallback: code=", code ? "present" : "missing", "error=", error);

      if (error) {
        toast({
          title: "Chyba autorizace",
          description: `Strava autorizace selhala: ${error}`,
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      if (!code) {
        toast({
          title: "Chyba",
          description: "Chybí autorizační kód",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        setStatusMessage("Ověřuji přihlášení...");

        // Wait a moment for auth to settle after redirect
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: { session } } = await supabase.auth.getSession();

        console.log("StravaCallback: session=", session ? "present" : "missing",
          "user=", session?.user?.email);

        if (!session) {
          throw new Error("Nejste přihlášeni. Přihlaste se a zkuste připojit Strava znovu.");
        }

        setStatusMessage("Vyměňuji autorizační kód za tokeny...");

        // Call the edge function directly with explicit auth header
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/strava-auth-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ code }),
        });

        const responseText = await response.text();
        console.log("StravaCallback: response status=", response.status, "body=", responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Unexpected response: ${responseText}`);
        }

        if (!response.ok) {
          throw new Error(data?.error || `Edge function error (${response.status})`);
        }

        if (data?.success) {
          toast({
            title: "Strava připojena",
            description: `Úspěšně připojeno k účtu: ${data.athlete?.username || data.athlete?.firstname || "Strava"}`,
          });
        }
      } catch (error: any) {
        console.error("Strava callback error:", error);
        toast({
          title: "Chyba",
          description: error.message || "Nepodařilo se připojit Strava",
          variant: "destructive",
        });
      } finally {
        setProcessing(false);
        navigate("/");
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  if (processing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{statusMessage}</p>
        </div>
      </div>
    );
  }

  return null;
}
