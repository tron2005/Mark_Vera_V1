import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

      if (error) {
        toast.error(`Chyba při připojování: ${error}`);
        navigate("/");
        return;
      }

      if (!code) {
        toast.error("Chybějící autorizační kód");
        navigate("/");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast.error("Nejste přihlášeni");
          navigate("/");
          return;
        }

        const { error: callbackError } = await supabase.functions.invoke(
          "google-auth-callback",
          {
            body: { code },
          }
        );

        if (callbackError) {
          throw callbackError;
        }

        toast.success("Google Calendar úspěšně připojen!");
        navigate("/");
      } catch (error: any) {
        console.error("Callback error:", error);
        toast.error(`Chyba: ${error.message}`);
        navigate("/");
      } finally {
        setProcessing(false);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Připojuji Google Calendar...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
