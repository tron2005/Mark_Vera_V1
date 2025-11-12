import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Note = {
  id: string;
  text: string;
  category: string;
  is_important: boolean;
  created_at: string;
  due_date?: string;
  location?: string;
  reminder_date?: string;
  recurrence?: string;
};

export const NotesList = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [category, setCategory] = useState("general");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [recurrence, setRecurrence] = useState("");

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Chyba načítání poznámek");
      return;
    }

    setNotes(data || []);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("notes").insert({
      user_id: user.id,
      text: newNote.trim(),
      category,
      is_important: false,
      due_date: dueDate || null,
      location: location || null,
      reminder_date: reminderDate || null,
      recurrence: recurrence || null,
    });

    if (error) {
      toast.error("Chyba při přidávání poznámky");
      return;
    }

    setNewNote("");
    setDueDate("");
    setLocation("");
    setReminderDate("");
    setRecurrence("");
    toast.success("Poznámka přidána");
    loadNotes();
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);

    if (error) {
      toast.error("Chyba při mazání poznámky");
      return;
    }

    toast.success("Poznámka smazána");
    loadNotes();
  };

  const toggleImportant = async (note: Note) => {
    const { error } = await supabase
      .from("notes")
      .update({ is_important: !note.is_important })
      .eq("id", note.id);

    if (error) {
      toast.error("Chyba při aktualizaci poznámky");
      return;
    }

    loadNotes();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold">📝 Poznámky</h2>
        
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Nová poznámka..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addNote()}
              className="flex-1"
            />
            
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="general">Obecné</option>
              <option value="work">Práce</option>
              <option value="personal">Osobní</option>
              <option value="todo">TODO</option>
            </select>
            
            <Button onClick={addNote}>Přidat</Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              placeholder="Čas dokončení"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm"
            />
            
            <Input
              placeholder="Místo konání"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="text-sm"
            />
            
            <Input
              type="datetime-local"
              placeholder="Upomínka"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="text-sm"
            />
            
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="px-2 py-1 border rounded-md bg-background text-sm"
            >
              <option value="">Bez opakování</option>
              <option value="daily">Denně</option>
              <option value="weekly">Týdně</option>
              <option value="monthly">Měsíčně</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {notes.length === 0 ? (
          <Card className="p-4 text-center text-muted-foreground">
            Žádné poznámky
          </Card>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">{note.text}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {note.category}
                    </Badge>
                    
                    {note.due_date && (
                      <Badge variant="secondary" className="text-xs">
                        📅 {new Date(note.due_date).toLocaleString("cs-CZ")}
                      </Badge>
                    )}
                    
                    {note.location && (
                      <Badge variant="secondary" className="text-xs">
                        📍 {note.location}
                      </Badge>
                    )}
                    
                    {note.reminder_date && (
                      <Badge variant="secondary" className="text-xs">
                        🔔 {new Date(note.reminder_date).toLocaleString("cs-CZ")}
                      </Badge>
                    )}
                    
                    {note.recurrence && (
                      <Badge variant="secondary" className="text-xs">
                        🔄 {note.recurrence === "daily" ? "Denně" : 
                            note.recurrence === "weekly" ? "Týdně" : "Měsíčně"}
                      </Badge>
                    )}
                  </div>
                  
                  <span className="text-xs text-muted-foreground">
                    Vytvořeno: {new Date(note.created_at).toLocaleString("cs-CZ")}
                  </span>
                </div>
                
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleImportant(note)}
                  >
                    <Star
                      className={`h-4 w-4 ${
                        note.is_important ? "fill-yellow-400 text-yellow-400" : ""
                      }`}
                    />
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
