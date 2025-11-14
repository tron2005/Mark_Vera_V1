import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Volume2 } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [markVoice, setMarkVoice] = useState("");
  const [veraVoice, setVeraVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [customInstructions, setCustomInstructions] = useState("");
  const [userDescription, setUserDescription] = useState("");
  const [trainerEnabled, setTrainerEnabled] = useState(true);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [bmi, setBmi] = useState<number | null>(null);
  const [bmr, setBmr] = useState<number | null>(null);

  useEffect(() => {
    loadSettings();
    loadVoices();
  }, []);

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setAvailableVoices(voices);
    } else {
      // Chrome needs a bit of time to load voices
      window.speechSynthesis.onvoiceschanged = () => {
        setAvailableVoices(window.speechSynthesis.getVoices());
      };
    }
  };

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("email, custom_instructions, user_description, trainer_enabled, google_refresh_token, strava_refresh_token, weight_kg, height_cm, age, gender, bmr")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const profile = data as any;
        setEmail(profile.email || "");
        setCustomInstructions(profile.custom_instructions || "");
        setUserDescription(profile.user_description || "");
        setTrainerEnabled(profile.trainer_enabled ?? true);
        setGoogleCalendarConnected(!!profile.google_refresh_token);
        setStravaConnected(!!profile.strava_refresh_token);
        setWeightKg(profile.weight_kg?.toString() || "");
        setHeightCm(profile.height_cm?.toString() || "");
        setAge(profile.age?.toString() || "");
        setGender(profile.gender || "male");
        
        if (profile.bmr) {
          setBmr(profile.bmr);
        }
        
        if (profile.weight_kg && profile.height_cm) {
          calculateBMI(profile.weight_kg, profile.height_cm);
        }
        if (profile.weight_kg && profile.height_cm && profile.age) {
          calculateBMR(profile.weight_kg, profile.height_cm, profile.age, profile.gender || "male");
        }
      }
    } catch (error) {
      console.error("Chyba při načítání nastavení:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateBMI = (weight: number, height: number) => {
    const heightInMeters = height / 100;
    const calculatedBMI = weight / (heightInMeters * heightInMeters);
    setBmi(calculatedBMI);
    return calculatedBMI;
  };

  const calculateBMR = (weight: number, height: number, ageYears: number, genderValue: string) => {
    // Mifflin-St Jeor Equation
    let calculatedBMR;
    if (genderValue === "male") {
      calculatedBMR = 10 * weight + 6.25 * height - 5 * ageYears + 5;
    } else {
      calculatedBMR = 10 * weight + 6.25 * height - 5 * ageYears - 161;
    }
    setBmr(calculatedBMR);
    return calculatedBMR;
  };

  const handleWeightChange = (value: string) => {
    setWeightKg(value);
    const weight = parseFloat(value);
    const height = parseFloat(heightCm);
    const ageYears = parseFloat(age);
    
    if (weight && height) {
      const calculatedBMI = calculateBMI(weight, height);
      if (ageYears) {
        calculateBMR(weight, height, ageYears, gender);
      }
    }
  };

  const handleHeightChange = (value: string) => {
    setHeightCm(value);
    const weight = parseFloat(weightKg);
    const height = parseFloat(value);
    const ageYears = parseFloat(age);
    
    if (weight && height) {
      const calculatedBMI = calculateBMI(weight, height);
      if (ageYears) {
        calculateBMR(weight, height, ageYears, gender);
      }
    }
  };

  const handleAgeChange = (value: string) => {
    setAge(value);
    const weight = parseFloat(weightKg);
    const height = parseFloat(heightCm);
    const ageYears = parseFloat(value);
    
    if (weight && height && ageYears) {
      calculateBMR(weight, height, ageYears, gender);
    }
  };

  const handleGenderChange = (value: string) => {
    setGender(value);
    const weight = parseFloat(weightKg);
    const height = parseFloat(heightCm);
    const ageYears = parseFloat(age);
    
    if (weight && height && ageYears) {
      calculateBMR(weight, height, ageYears, value);
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
        const weight = parseFloat(weightKg);
        const height = parseFloat(heightCm);
        const ageYears = parseFloat(age);
        const calculatedBMI = weight && height ? calculateBMI(weight, height) : null;
        const calculatedBMR = weight && height && ageYears ? calculateBMR(weight, height, ageYears, gender) : null;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            email,
            custom_instructions: customInstructions,
            user_description: userDescription,
            trainer_enabled: trainerEnabled,
            weight_kg: weight || null,
            height_cm: height || null,
            age: ageYears || null,
            gender: gender,
            bmi: calculatedBMI,
            bmr: calculatedBMR,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        error = updateError;
      } else {
        // Insert nového profilu
        const weight = parseFloat(weightKg);
        const height = parseFloat(heightCm);
        const ageYears = parseFloat(age);
        const calculatedBMI = weight && height ? calculateBMI(weight, height) : null;
        const calculatedBMR = weight && height && ageYears ? calculateBMR(weight, height, ageYears, gender) : null;

        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            email,
            custom_instructions: customInstructions,
            user_description: userDescription,
            trainer_enabled: trainerEnabled,
            weight_kg: weight || null,
            height_cm: height || null,
            age: ageYears || null,
            gender: gender,
            bmi: calculatedBMI,
            bmr: calculatedBMR,
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

  const testVoice = (voiceName: string, mode: 'mark' | 'vera') => {
    const utterance = new SpeechSynthesisUtterance(
      mode === 'mark' 
        ? "Ahoj, jsem Mark, váš sportovní trenér" 
        : "Ahoj, jsem Vera, vaše wellness asistentka"
    );
    utterance.lang = 'cs-CZ';
    utterance.rate = 0.85;
    
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.pitch = mode === 'mark' ? 0.9 : 1.1;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    
    toast({
      title: "Test hlasu",
      description: `Přehrávám hlas pro ${mode === 'mark' ? 'Marka' : 'Veru'}...`,
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

          <div className="space-y-4">
            <Label>Hlasy asistentů</Label>
            <p className="text-sm text-muted-foreground">
              Vyberte různé hlasy pro každého asistenta. Kvalita závisí na prohlížeči - Chrome a Edge mají nejlepší české hlasy (např. Zuzana od Microsoft).
            </p>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mark-voice">🔧 M.A.R.K. (Sportovní trenér)</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => testVoice(markVoice, 'mark')}
                    disabled={!markVoice}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </div>
                <Select value={markVoice} onValueChange={setMarkVoice}>
                  <SelectTrigger id="mark-voice">
                    <SelectValue placeholder="Vyberte hlas pro Marka" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vera-voice">🤖 V.E.R.A. (Wellness asistentka)</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => testVoice(veraVoice, 'vera')}
                    disabled={!veraVoice}
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </div>
                <Select value={veraVoice} onValueChange={setVeraVoice}>
                  <SelectTrigger id="vera-voice">
                    <SelectValue placeholder="Vyberte hlas pro Veru" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} ({voice.lang})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Fyzický profil */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Fyzický profil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Váha (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="75"
                    value={weightKg}
                    onChange={(e) => handleWeightChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Výška (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="180"
                    value={heightCm}
                    onChange={(e) => handleHeightChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Věk</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="30"
                    value={age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Pohlaví</Label>
                  <Select value={gender} onValueChange={handleGenderChange}>
                    <SelectTrigger id="gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Muž</SelectItem>
                      <SelectItem value="female">Žena</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Vypočítané hodnoty */}
              {(bmi !== null || bmr !== null) && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  {bmi !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">BMI (Body Mass Index):</span>
                      <span className="text-lg font-bold">
                        {bmi.toFixed(1)}
                        <span className="text-sm font-normal ml-2 text-muted-foreground">
                          {bmi < 18.5 ? "(Podváha)" : bmi < 25 ? "(Normální)" : bmi < 30 ? "(Nadváha)" : "(Obezita)"}
                        </span>
                      </span>
                    </div>
                  )}
                  {bmr !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">BMR (Bazální metabolismus):</span>
                      <span className="text-lg font-bold">
                        {Math.round(bmr)} kcal/den
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    BMR je množství kalorií, které vaše tělo potřebuje v klidu. Pro aktivní den násobte 1.5-2x.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
