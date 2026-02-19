import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Plus, Eye, EyeOff, Save } from "lucide-react";

interface StravaTester {
  id: string;
  tester_name: string;
  tester_email: string | null;
  strava_client_id: string | null;
  strava_client_secret: string | null;
  strava_refresh_token: string | null;
  is_active: boolean;
}

export default function StravaTesterManager() {
  const { toast } = useToast();
  const [testers, setTesters] = useState<StravaTester[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [newTester, setNewTester] = useState({
    tester_name: "",
    tester_email: "",
    strava_client_id: "",
    strava_client_secret: "",
    strava_refresh_token: "",
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTesters();
  }, []);

  const loadTesters = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("strava_testers")
        .select("*")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTesters((data as StravaTester[]) || []);
    } catch (error) {
      console.error("Chyba při načítání testerů:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTester = async () => {
    if (!newTester.tester_name.trim()) {
      toast({
        title: "Chyba",
        description: "Zadejte jméno testera",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni");

      const { error } = await supabase.from("strava_testers").insert({
        owner_user_id: user.id,
        tester_name: newTester.tester_name,
        tester_email: newTester.tester_email || null,
        strava_client_id: newTester.strava_client_id || null,
        strava_client_secret: newTester.strava_client_secret || null,
        strava_refresh_token: newTester.strava_refresh_token || null,
      });

      if (error) throw error;

      toast({
        title: "Tester přidán",
        description: `${newTester.tester_name} byl úspěšně přidán`,
      });

      setNewTester({
        tester_name: "",
        tester_email: "",
        strava_client_id: "",
        strava_client_secret: "",
        strava_refresh_token: "",
      });
      loadTesters();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const updateTester = async (tester: StravaTester) => {
    setSaving(tester.id);
    try {
      const { error } = await supabase
        .from("strava_testers")
        .update({
          tester_name: tester.tester_name,
          tester_email: tester.tester_email,
          strava_client_id: tester.strava_client_id,
          strava_client_secret: tester.strava_client_secret,
          strava_refresh_token: tester.strava_refresh_token,
        })
        .eq("id", tester.id);

      if (error) throw error;

      toast({
        title: "Uloženo",
        description: `${tester.tester_name} aktualizován`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const deleteTester = async (id: string, name: string) => {
    if (!confirm(`Opravdu smazat testera ${name}?`)) return;

    try {
      const { error } = await supabase
        .from("strava_testers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Smazáno",
        description: `${name} byl odstraněn`,
      });
      loadTesters();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTesterField = (id: string, field: keyof StravaTester, value: string) => {
    setTesters(testers.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const toggleShowSecret = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Načítání testerů...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted/50 rounded-lg text-sm">
        <p className="font-medium mb-2">📋 Jak přidat testera:</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Tester si vytvoří aplikaci na <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener" className="text-primary underline">strava.com/settings/api</a></li>
          <li>Do "Authorization Callback Domain" zadá: <code className="bg-background px-1 rounded">{window.location.host}</code></li>
          <li>Zkopíruje <strong>Client ID</strong> a <strong>Client Secret</strong> sem</li>
          <li>Zadá email, pod kterým se tester přihlašuje do aplikace</li>
        </ol>
      </div>

      <p className="text-sm text-muted-foreground">
        Každý tester může mít vlastní Strava API credentials pro obejití limitu 100 atletů.
      </p>

      {/* Existující testeři */}
      {testers.map((tester) => (
        <Card key={tester.id} className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Input
                value={tester.tester_name}
                onChange={(e) => updateTesterField(tester.id, "tester_name", e.target.value)}
                className="font-medium max-w-[200px]"
                placeholder="Jméno testera"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleShowSecret(tester.id)}
                >
                  {showSecrets[tester.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateTester(tester)}
                  disabled={saving === tester.id}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteTester(tester.id, tester.tester_name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email testera (pro propojení s účtem)</Label>
                <Input
                  type="email"
                  value={tester.tester_email || ""}
                  onChange={(e) => updateTesterField(tester.id, "tester_email", e.target.value)}
                  placeholder="tester@email.cz"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  type={showSecrets[tester.id] ? "text" : "password"}
                  value={tester.strava_client_id || ""}
                  onChange={(e) => updateTesterField(tester.id, "strava_client_id", e.target.value)}
                  placeholder="Strava Client ID"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type={showSecrets[tester.id] ? "text" : "password"}
                  value={tester.strava_client_secret || ""}
                  onChange={(e) => updateTesterField(tester.id, "strava_client_secret", e.target.value)}
                  placeholder="Strava Client Secret"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Refresh Token</Label>
                <Input
                  type={showSecrets[tester.id] ? "text" : "password"}
                  value={tester.strava_refresh_token || ""}
                  onChange={(e) => updateTesterField(tester.id, "strava_refresh_token", e.target.value)}
                  placeholder="Strava Refresh Token"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Přidat nového testera */}
      {testers.length < 3 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Přidat testera ({testers.length}/3)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Jméno testera</Label>
                <Input
                  value={newTester.tester_name}
                  onChange={(e) => setNewTester({ ...newTester, tester_name: e.target.value })}
                  placeholder="např. Jan Novák"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email testera (pro propojení s účtem)</Label>
                <Input
                  type="email"
                  value={newTester.tester_email}
                  onChange={(e) => setNewTester({ ...newTester, tester_email: e.target.value })}
                  placeholder="tester@email.cz"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  value={newTester.strava_client_id}
                  onChange={(e) => setNewTester({ ...newTester, strava_client_id: e.target.value })}
                  placeholder="Strava Client ID"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  value={newTester.strava_client_secret}
                  onChange={(e) => setNewTester({ ...newTester, strava_client_secret: e.target.value })}
                  placeholder="Strava Client Secret"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Refresh Token</Label>
                <Input
                  type="password"
                  value={newTester.strava_refresh_token}
                  onChange={(e) => setNewTester({ ...newTester, strava_refresh_token: e.target.value })}
                  placeholder="Strava Refresh Token"
                />
              </div>
            </div>
            <Button onClick={addTester} disabled={adding} className="w-full">
              {adding ? "Přidávám..." : "Přidat testera"}
            </Button>
          </CardContent>
        </Card>
      )}

      {testers.length >= 3 && (
        <p className="text-sm text-muted-foreground text-center">
          Dosažen maximální počet testerů (3)
        </p>
      )}
    </div>
  );
}
