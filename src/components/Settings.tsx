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

   // Test Google Calendar fields
   const [testingCalendar, setTestingCalendar] = useState(false);
   const [testSummary, setTestSummary] = useState("Hruboskalský půlmaraton");
   const [testDate, setTestDate] = useState<string>("");
   const [testTime, setTestTime] = useState<string>("08:00");

  useEffect(() => {
    loadSettings();
    loadVoices();
  }, []);

  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    console.log('Dostupné hlasy:', voices.map(v => `${v.name} (${v.lang})`));
    if (voices.length > 0) {
      setAvailableVoices(voices);
    } else {
      // Chrome needs a bit of time to load voices
      window.speechSynthesis.onvoiceschanged = () => {
        const newVoices = window.speechSynthesis.getVoices();
        console.log('Hlasy načteny:', newVoices.map(v => `${v.name} (${v.lang})`));
        setAvailableVoices(newVoices);
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

  const createTestCalendarEvent = async (allDay: boolean) => {
    try {
      setTestingCalendar(true);
      if (!testDate) throw new Error("Zadej datum");
      const start = allDay ? testDate : `${testDate}T${testTime}`;

      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          summary: testSummary || 'Test událost',
          start
        }
      });

      if (error) throw error;
      if ((data as any)?.success) {
        toast({
          title: 'Událost vytvořena',
          description: (data as any)?.eventLink ? `Odkaz: ${(data as any).eventLink}` : 'Zkontroluj Google Kalendář.'
        });
      } else {
        toast({ title: 'Odpověď', description: JSON.stringify(data) });
      }
    } catch (err: any) {
      console.error('Calendar test error:', err);
      toast({ title: 'Chyba při vytváření události', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setTestingCalendar(false);
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
          <CardTitle>Test Google Kalendáře</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="testSummary">Název</Label>
              <Input id="testSummary" value={testSummary} onChange={(e)=>setTestSummary(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testDate">Datum</Label>
              <Input id="testDate" type="date" value={testDate} onChange={(e)=>setTestDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testTime">Čas (pro 1h událost)</Label>
              <Input id="testTime" type="time" value={testTime} onChange={(e)=>setTestTime(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <Button disabled={testingCalendar || !testDate} onClick={()=>createTestCalendarEvent(true)}>
              {testingCalendar ? 'Vytvářím…' : 'Vytvořit celodenní událost'}
            </Button>
            <Button variant="outline" disabled={testingCalendar || !testDate || !testTime} onClick={()=>createTestCalendarEvent(false)}>
              {testingCalendar ? 'Vytvářím…' : 'Vytvořit 1h událost'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Test volá přímo backend funkci a vypíše přesnou chybu, pokud nastane.</p>
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

      <Card>
        <CardHeader>
          <CardTitle>O aplikaci & Roadmapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Verze 1.0.0</h3>
            <p className="text-sm text-muted-foreground">
              První stabilní verze s kompletním fitness asistentským systémem
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">✅ Aktuální funkce</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>🤖 Dva AI asistenti (M.A.R.K. fitness trenér & V.E.R.A. wellness asistentka)</li>
              <li>🔊 Text-to-speech s vlastním výběrem hlasů</li>
              <li>🏃 Strava integrace - import aktivit a statistik</li>
              <li>💪 Import z Garmin (.FIT soubory) - aktivity, spánek, HRV</li>
              <li>📊 Import z Runalyze - kompletní běžecká historie</li>
              <li>😴 Sledování spánku s pokročilými metrikami</li>
              <li>❤️ Monitoring HRV a klidové srdeční frekvence</li>
              <li>⚖️ Tělesné složení a BMI tracking</li>
              <li>🎯 Správa závodních cílů a tréninková periodizace</li>
              <li>📈 Grafy a vizualizace všech fitness dat</li>
              <li>📝 Chytré poznámky s AI analýzou</li>
              <li>📅 Google Calendar integrace</li>
              <li>📧 Export poznámek emailem</li>
              <li>🧮 BMR kalkulačka podle pohlaví a věku</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">🚀 Plánované funkce (Roadmapa)</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-1">📥 Import a správa dat</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Nahrávání textových souborů z Runalyze (všechny typy exportů)</li>
                  <li>Import FIT souborů z různých zdrojů</li>
                  <li>Integrace s Intervals.icu</li>
                  <li>Detekce duplicit při importu dat</li>
                  <li>Zobrazení statusu aktualizací v chatu</li>
                  <li>Multi-user testování a správa přístupů</li>
                  <li>Ruční export z RingConn - vlastní záložka pro lepší data o spánku</li>
                  <li>Integrace s Health Connect</li>
                  <li>Jednotný graf spánku při datech z více zařízení (s možností přepnutí)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">🏋️ Tréninkové plány a výživa</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>AI generování tréninkových plánů pro hubnutí a budování kondice</li>
                  <li>Kalorické tabulky a tracking příjmu</li>
                  <li>Cílová hmotnost s predikci data dosažení</li>
                  <li>Automatická kompenzace oslav, večírků a nemocí v plánu</li>
                  <li>Plán upravený na aktuální kondici a pokrok</li>
                  <li>AI doporučení suplementů a dávkování</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">📅 Kalendář a plánování</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Vizualizace dodržování plánu v kalendáři (dny úspěch/neúspěch)</li>
                  <li>Predikce dosažení cíle s ohledem na životní události</li>
                  <li>Automatické přeplánování při nemoci nebo nepředvídaných událostech</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">📊 Vizualizace a statistiky</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Vyobrazení aktivit dle časového období (výchozí: poslední týden)</li>
                  <li>AI shrnutí ke každému grafu - denní a týdenní přehledy s analýzou trendů</li>
                  <li>Tlačítko pro generování sumářů (spánek, poslední trénink atd.)</li>
                  <li>Počasí na základě umístění tréninku při exportu bez GPS</li>
                  <li>3D figurína lidského těla (předek/zadek) se svalovými partiemi</li>
                  <li>Interaktivní zobrazení cvičených svalových skupin s barevným kódováním:
                    <ul className="ml-4 mt-1">
                      <li>🟢 Zelená = svalové partie, které byly aktivně cvičeny</li>
                      <li>🟡 Žlutá = partie, které by měly být více zapojeny do tréninku</li>
                      <li>⚪ Šedá = nevyužité nebo málo cvičené partie</li>
                    </ul>
                  </li>
                  <li>Jednotný graf spánku při datech z více zařízení s možností přepnutí mezi zdroji</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">💪 Tréninková knihovna</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Karta tréninkové rady pro různé délky běhu (videa, články, odkazy)</li>
                  <li>Tréninky VR brýle Les Mills BodyCombat</li>
                  <li>Import Excel tréninků (Roman Maršálek, Tomáš Jehličná)</li>
                  <li>Kruhák, švihadlo, přitahy doma, flankyrovka</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">🧠 Paměť a konverzace</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Statistiky: počet poznámek, počet konverzací</li>
                  <li>Nastavení doby uchování konverzací</li>
                  <li>Dlouhodobá paměť napříč sezeními</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">🔗 API klíče a personalizace</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Možnost zadat vlastní API klíče nebo autorizační kódy v Nastavení</li>
                  <li>Podpora pro Strava, Garmin, Weather API a další služby</li>
                  <li>Každý uživatel má své vlastní přístupové údaje uložené bezpečně</li>
                  <li>Nezávislé integrace pro multi-user prostředí</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">🚗 Správa vozidel</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Údaje o vozidlech (TK, pojistné, výměny oleje, rozvody)</li>
                  <li>Typ oleje, pneumatiky, připomínky servisů</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-1">📚 Vzdělávání a osobní rozvoj</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Upomínky Duolingo, Udemy</li>
                  <li>Sledování času na učení a pokroku</li>
                  <li>Vlastní záložka pro jazykového lektora</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Máte nápad na novou funkci? Napište to asistentovi! 💡
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
