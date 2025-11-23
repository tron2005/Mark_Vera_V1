import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Flame, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface BodyCombatWorkout {
  id: string;
  workout_date: string;
  duration_minutes: number;
  track_number?: string;
  intensity?: number;
  calories_estimate?: number;
  notes?: string;
}

export const BodyCombatTracker = () => {
  const [workouts, setWorkouts] = useState<BodyCombatWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState("45");
  const [trackNumber, setTrackNumber] = useState("");
  const [intensity, setIntensity] = useState("7");
  const [caloriesEstimate, setCaloriesEstimate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bodycombat_workouts")
        .select("*")
        .eq("user_id", user.id)
        .order("workout_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setWorkouts(data || []);
    } catch (error) {
      console.error("Error loading BodyCombat workouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("bodycombat_workouts")
        .insert({
          user_id: user.id,
          workout_date: new Date(workoutDate).toISOString(),
          duration_minutes: parseInt(duration),
          track_number: trackNumber || null,
          intensity: intensity ? parseInt(intensity) : null,
          calories_estimate: caloriesEstimate ? parseInt(caloriesEstimate) : null,
          notes: notes || null,
        });

      if (error) throw error;

      toast.success("Trénink přidán");
      
      // Reset form
      setWorkoutDate(new Date().toISOString().split('T')[0]);
      setDuration("45");
      setTrackNumber("");
      setIntensity("7");
      setCaloriesEstimate("");
      setNotes("");
      setShowForm(false);
      
      loadWorkouts();
    } catch (error: any) {
      console.error("Error adding workout:", error);
      toast.error(error.message || "Nepodařilo se přidat trénink");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bodycombat_workouts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Trénink smazán");
      loadWorkouts();
    } catch (error: any) {
      console.error("Error deleting workout:", error);
      toast.error("Nepodařilo se smazat trénink");
    }
  };

  if (loading) {
    return <div>Načítání...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Les Mills BodyCombat
            </CardTitle>
            <CardDescription>
              Sledování BodyCombat tréninků na Meta Quest 2
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            size="sm"
            variant={showForm ? "outline" : "default"}
          >
            {showForm ? "Zrušit" : <><Plus className="h-4 w-4 mr-2" />Přidat</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workout-date">Datum tréninku</Label>
                <Input
                  id="workout-date"
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Délka (minuty)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="track">Track (např. BC01)</Label>
                <Input
                  id="track"
                  type="text"
                  placeholder="BC01"
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intensity">Intenzita (1-10)</Label>
                <Input
                  id="intensity"
                  type="number"
                  min="1"
                  max="10"
                  value={intensity}
                  onChange={(e) => setIntensity(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calories">Kalorie (odhad)</Label>
              <Input
                id="calories"
                type="number"
                placeholder="350"
                value={caloriesEstimate}
                onChange={(e) => setCaloriesEstimate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Poznámky</Label>
              <Textarea
                id="notes"
                placeholder="Jak se ti dařilo..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Ukládám..." : "Uložit trénink"}
            </Button>
          </form>
        )}

        {/* Workouts list */}
        <div className="space-y-3">
          {workouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Zatím žádné tréninky. Přidej první!
            </p>
          ) : (
            workouts.map((workout) => (
              <div key={workout.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {new Date(workout.workout_date).toLocaleDateString('cs-CZ')}
                      </span>
                      {workout.track_number && (
                        <Badge variant="outline">{workout.track_number}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span>{workout.duration_minutes} min</span>
                      {workout.intensity && (
                        <span>Intenzita: {workout.intensity}/10</span>
                      )}
                      {workout.calories_estimate && (
                        <span>{workout.calories_estimate} kcal</span>
                      )}
                    </div>
                    {workout.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{workout.notes}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(workout.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
