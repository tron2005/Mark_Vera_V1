import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Heart, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";

type BPRecord = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  measured_at: string;
  note?: string;
};

// WHO klasifikace krevního tlaku
function classifyBP(sys: number, dia: number): { label: string; color: string; bg: string } {
  if (sys < 120 && dia < 80)  return { label: "Optimální",       color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/30"  };
  if (sys < 130 && dia < 85)  return { label: "Normální",         color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/30"    };
  if (sys < 140 && dia < 90)  return { label: "Vysoký normální",  color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30" };
  if (sys < 160 && dia < 100) return { label: "Hypertenze I.",    color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" };
  return                              { label: "Hypertenze II.",   color: "text-red-600 dark:text-red-400",     bg: "bg-red-50 dark:bg-red-950/30"      };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function BloodPressureWidget() {
  const [records, setRecords] = useState<BPRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Formulář
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("blood_pressure")
      .select("*")
      .eq("user_id", user.id)
      .order("measured_at", { ascending: false })
      .limit(20);

    if (!error) setRecords((data || []) as BPRecord[]);
    setLoading(false);
  };

  const saveRecord = async () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    const pls = pulse ? parseInt(pulse) : null;

    if (!sys || !dia || sys < 60 || sys > 250 || dia < 40 || dia > 150) {
      toast.error("Zadej platné hodnoty tlaku (horní 60–250, dolní 40–150)");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase.from("blood_pressure").insert({
      user_id: user.id,
      systolic: sys,
      diastolic: dia,
      pulse: pls,
      note: note.trim() || null,
      measured_at: new Date().toISOString(),
    });

    if (error) {
      toast.error("Chyba při ukládání: " + error.message);
    } else {
      toast.success("Tlak uložen");
      setSystolic(""); setDiastolic(""); setPulse(""); setNote("");
      setShowForm(false);
      loadRecords();
    }
    setSaving(false);
  };

  const deleteRecord = async (id: string) => {
    const { error } = await supabase.from("blood_pressure").delete().eq("id", id);
    if (!error) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
      toast.success("Záznam smazán");
    }
  };

  // Trend: porovnej poslední dvě měření
  const trend = records.length >= 2
    ? records[0].systolic - records[1].systolic
    : null;

  const latest = records[0];
  const latestClass = latest ? classifyBP(latest.systolic, latest.diastolic) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-red-500" />
            Krevní tlak
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3 w-3 mr-1" />
            Přidat měření
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Formulář */}
        {showForm && (
          <div className="p-4 rounded-lg border bg-muted/40 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Horní (sys)</Label>
                <Input
                  type="number"
                  placeholder="120"
                  value={systolic}
                  onChange={(e) => setSystolic(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dolní (dia)</Label>
                <Input
                  type="number"
                  placeholder="80"
                  value={diastolic}
                  onChange={(e) => setDiastolic(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tep (bpm)</Label>
                <Input
                  type="number"
                  placeholder="70"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Poznámka (nepovinné)</Label>
              <Input
                placeholder="ráno, po cvičení, po kávě..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={saveRecord} disabled={saving} className="flex-1">
                {saving ? "Ukládám..." : "Uložit"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Zrušit
              </Button>
            </div>
          </div>
        )}

        {/* Poslední hodnota */}
        {latest && latestClass && (
          <div className={`rounded-lg p-4 ${latestClass.bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-3xl font-bold ${latestClass.color}`}>
                  {latest.systolic}/{latest.diastolic}
                  <span className="text-base font-normal ml-1 text-muted-foreground">mmHg</span>
                </div>
                {latest.pulse && (
                  <div className="text-sm text-muted-foreground mt-1">
                    ❤️ {latest.pulse} bpm
                  </div>
                )}
                <div className={`text-sm font-medium mt-1 ${latestClass.color}`}>
                  {latestClass.label}
                </div>
                {latest.note && (
                  <div className="text-xs text-muted-foreground mt-0.5">{latest.note}</div>
                )}
              </div>
              <div className="text-right">
                {trend !== null && (
                  <div className="flex items-center gap-1 justify-end mb-1">
                    {trend < -3 ? <TrendingDown className="h-4 w-4 text-green-500" /> :
                     trend > 3  ? <TrendingUp className="h-4 w-4 text-red-500" /> :
                                  <Minus className="h-4 w-4 text-muted-foreground" />}
                    <span className={`text-sm font-medium ${trend < -3 ? "text-green-500" : trend > 3 ? "text-red-500" : "text-muted-foreground"}`}>
                      {trend > 0 ? "+" : ""}{trend} mmHg
                    </span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {formatDate(latest.measured_at)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Historie */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítám...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Zatím žádná měření. Přidej první hodnotu.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Historie</p>
            {records.slice(1).map((r) => {
              const cls = classifyBP(r.systolic, r.diastolic);
              return (
                <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 group">
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold text-sm ${cls.color}`}>
                      {r.systolic}/{r.diastolic}
                    </span>
                    {r.pulse && <span className="text-xs text-muted-foreground">{r.pulse} bpm</span>}
                    {r.note && <span className="text-xs text-muted-foreground italic">{r.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(r.measured_at)}</span>
                    <button
                      onClick={() => deleteRecord(r.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WHO legenda */}
        <div className="pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-0.5">
          {[
            { label: "Optimální", range: "< 120/80",   color: "bg-green-500"  },
            { label: "Normální",  range: "< 130/85",   color: "bg-blue-500"   },
            { label: "Zvýšený",   range: "130–139/85–89", color: "bg-yellow-500" },
            { label: "Hypertenze",range: "≥ 140/90",   color: "bg-red-500"    },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
              <span className="text-xs text-muted-foreground">{item.label} ({item.range})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
