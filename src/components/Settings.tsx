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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("email, voice_preference, custom_instructions")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setEmail(data.email || "");
        setVoicePreference(data.voice_preference || "alloy");
        setCustomInstructions(data.custom_instructions || "");
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
            <Label htmlFor="instructions">Vlastní instrukce</Label>
            <Textarea
              id="instructions"
              placeholder="Jak má se mnou asistent mluvit..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={6}
            />
            <p className="text-sm text-muted-foreground">
              Definujte, jak má asistent komunikovat (styl, tón, preference)
            </p>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full">
            {saving ? "Ukládání..." : "Uložit nastavení"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
