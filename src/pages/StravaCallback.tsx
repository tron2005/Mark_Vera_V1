import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function StravaCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const error = searchParams.get("error");

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
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error("Nejste přihlášeni");
        }

        const { data, error: functionError } = await supabase.functions.invoke(
          "strava-auth-callback",
          {
            body: { code },
          }
        );

        if (functionError) throw functionError;

        if (data?.success) {
          toast({
            title: "Strava připojena",
            description: `Úspěšně připojeno k účtu: ${data.athlete?.username || "Strava"}`,
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
          <p className="text-muted-foreground">Zpracovávám Strava připojení...</p>
        </div>
      </div>
    );
  }

  return null;
}
