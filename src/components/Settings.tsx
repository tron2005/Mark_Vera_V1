import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const VOICES = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "shimmer", label: "Shimmer" },
];

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [voicePreference, setVoicePreference] = useState("alloy");
  const [customInstructions, setCustomInstructions] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [trainerEnabled, setTrainerEnabled] = useState(true);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("email, voice_preference, custom_instructions, user_description, trainer_enabled, google_refresh_token, strava_refresh_token")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmail(data.email || "");
        setVoicePreference(data.voice_preference || "alloy");
        setCustomInstructions(data.custom_instructions || "");
        setUserDescription(data.user_description || "");
        setTrainerEnabled(data.trainer_enabled ?? true);
        setGoogleCalendarConnected(!!data.google_refresh_token);
        setStravaConnected(!!data.strava_refresh_token);
      }
    } catch (error) {
      console.error("Chyba při načítání nastavení:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni");

      // Nejprve zkontrolovat, zda profil existuje
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let error;
      if (existingProfile) {
        // Update existujícího profilu
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            email,
            voice_preference: voicePreference,
            custom_instructions: customInstructions,
            user_description: userDescription,
            trainer_enabled: trainerEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        error = updateError;
      } else {
        // Insert nového profilu
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email,
            voice_preference: voicePreference,
            custom_instructions: customInstructions,
            user_description: userDescription,
            trainer_enabled: trainerEnabled,
          });
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: "Nastavení uloženo",
        description: "Vaše preference byly úspěšně aktualizovány",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testVoice = () => {
    const utterance = new SpeechSynthesisUtterance("Ahoj, toto je testovací věta. Jak zní můj hlas?");
    utterance.lang = "cs-CZ";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Note: Web Speech API nemá přímou podporu pro výběr konkrétního hlasu "alloy", "echo" atd.
    // Tyto názvy jsou z OpenAI API. Web Speech API používá systémové hlasy.
    const voices = speechSynthesis.getVoices();
    const czechVoice = voices.find(v => v.lang.startsWith("cs"));
    if (czechVoice) {
      utterance.voice = czechVoice;
    }
    
    speechSynthesis.speak(utterance);
    
    toast({
      title: "Test hlasu",
      description: "Přehrávám testovací větu...",
    });
  };

  const connectGoogleCalendar = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      toast({
        title: "Chyba konfigurace",
        description: "Google Client ID není nastaven",
        variant: "destructive",
      });
      return;
    }
    
    const redirectUri = `${window.location.origin}/auth/callback`;
    const scope = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scope,
      access_type: "offline",
      prompt: "consent",
    })}`;
    
    window.location.href = authUrl;
  };

  const disconnectGoogleCalendar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni");

      const { error } = await supabase
        .from("profiles")
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setGoogleCalendarConnected(false);
      toast({
        title: "Google Calendar odpojen",
        description: "Integrace byla úspěšně odpojena",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const connectStrava = () => {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
    
    if (!clientId) {
      toast({
        title: "Chyba konfigurace",
        description: "Strava Client ID není nastaven v .env",
        variant: "destructive",
      });
      return;
    }
    
    const redirectUri = `${window.location.origin}/auth/strava-callback`;
    const scope = "read,activity:read_all,profile:read_all";
    
    const authUrl = `https://www.strava.com/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scope,
      approval_prompt: "force",
    })}`;
    
    window.location.href = authUrl;
  };

  const disconnectStrava = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni");

      const { error } = await supabase
        .from("profiles")
        .update({
          strava_access_token: null,
          strava_refresh_token: null,
          strava_token_expiry: null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setStravaConnected(false);
      toast({
        title: "Strava odpojena",
        description: "Integrace byla úspěšně odpojena",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-8">Načítání nastavení...</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Nastavení</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vas@email.cz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Email pro odesílání sumářů poznámek
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="voice">Preferovaný hlas</Label>
              <Button type="button" variant="outline" size="sm" onClick={testVoice}>
                Vyzkoušet hlas
              </Button>
            </div>
            <Select value={voicePreference} onValueChange={setVoicePreference}>
              <SelectTrigger id="voice">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((voice) => (
                  <SelectItem key={voice.value} value={voice.value}>
                    {voice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Hlas pro syntézu řeči asistenta (OpenAI hlasy - alloy, echo, shimmer). Poznámka: Test hlasu používá systémové hlasy prohlížeče, skutečný hlas se použije při generování audio odpovědí.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Google Integrace</Label>
            {googleCalendarConnected ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-green-600 dark:text-green-400">✓ Připojeno</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={disconnectGoogleCalendar}
                >
                  Odpojit
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={connectGoogleCalendar}
                className="w-full"
              >
                Připojit Google služby
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Umožní asistentovi vytvářet události v Google Calendar a exportovat poznámky do Google Tasks (Keep alternativa). 
              <span className="block mt-1 text-xs">Poznámka: V testovacím režimu platí tokeny 7 dní. Pro trvalé připojení je potřeba publikovat aplikaci v Google Cloud Console.</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Strava Integrace</Label>
            {stravaConnected ? (
              <div className="flex items-center gap-2">
                <p className="text-sm text-green-600 dark:text-green-400">✓ Připojeno</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={disconnectStrava}
                >
                  Odpojit
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={connectStrava}
                className="w-full"
              >
                Připojit Strava
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Umožní asistentovi přístup k vašim aktivitám, běhům, cyklistickým výkonům a segmentům pro fitness koučování.
            </p>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            {saving ? "Ukládání..." : "Uložit nastavení"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vlastní instrukce asistenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="custom_instructions">Jak se má asistent chovat?</Label>
            <Textarea
              id="custom_instructions"
              placeholder="Například: Buď přátelský a používej emojis, upozorni mě na důležité schůzky..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>O tobě</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="user_description">Informace o tobě</Label>
            <Textarea
              id="user_description"
              placeholder="Řekni asistentovi o sobě: zájmy, rodina, práce, cíle... Tyto informace pomohou poskytnout personalizované rady."
              value={userDescription}
              onChange={(e) => setUserDescription(e.target.value)}
              rows={6}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fitness Trenér</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Zapnout AI fitness trenéra</Label>
              <p className="text-sm text-muted-foreground">
                Trenér má přístup k datům ze Stravy a poskytuje sportovní rady
              </p>
            </div>
            <Button
              variant={trainerEnabled ? "default" : "outline"}
              onClick={() => setTrainerEnabled(!trainerEnabled)}
            >
              {trainerEnabled ? "Zapnuto" : "Vypnuto"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
