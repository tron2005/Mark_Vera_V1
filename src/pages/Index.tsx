import { useState, useEffect } from "react";
import { Auth } from "@/components/Auth";
import { ChatInterface } from "@/components/ChatInterface";
import { NotesList } from "@/components/NotesList";
import Settings from "@/components/Settings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LogOut, MessageSquare, StickyNote, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"mark" | "vera">("mark");
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      if (session) {
        initializeConversation();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        initializeConversation();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeConversation = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Vytvořit novou konverzaci
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        mode: "mark",
        title: "Nová konverzace",
      })
      .select()
      .single();

    if (error) {
      toast.error("Chyba při vytváření konverzace");
      return;
    }

    setConversationId(data.id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Odhlášení úspěšné");
  };

  const switchMode = async (newMode: "mark" | "vera") => {
    setMode(newMode);
    
    // Vytvořit novou konverzaci pro nový režim
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        mode: newMode,
        title: `${newMode === "vera" ? "V.E.R.A." : "M.A.R.K."} konverzace`,
      })
      .select()
      .single();

    if (error) {
      toast.error("Chyba při přepínání režimu");
      return;
    }

    setConversationId(data.id);
    toast.success(`Přepnuto na ${newMode === "vera" ? "V.E.R.A." : "M.A.R.K."}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-2xl">Načítání...</div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b bg-card p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">🤖 M.A.R.K. / V.E.R.A.</h1>
            
            <div className="flex gap-2">
              <Button
                variant={mode === "mark" ? "default" : "outline"}
                onClick={() => switchMode("mark")}
                size="sm"
              >
                M.A.R.K.
              </Button>
              <Button
                variant={mode === "vera" ? "default" : "outline"}
                onClick={() => switchMode("vera")}
                size="sm"
              >
                V.E.R.A.
              </Button>
            </div>
          </div>

          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Odhlásit
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Tabs defaultValue="chat" className="h-full flex flex-col">
          <div className="border-b bg-card px-4">
            <TabsList className="w-full max-w-7xl mx-auto">
              <TabsTrigger value="chat" className="flex-1">
                <MessageSquare className="mr-2 h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex-1">
                <StickyNote className="mr-2 h-4 w-4" />
                Poznámky
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Nastavení
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="h-full max-w-7xl mx-auto">
              <TabsContent value="chat" className="h-full m-0">
                {conversationId && (
                  <ChatInterface conversationId={conversationId} mode={mode} />
                )}
              </TabsContent>

              <TabsContent value="notes" className="h-full m-0 overflow-y-auto">
                <NotesList />
              </TabsContent>

              <TabsContent value="settings" className="h-full m-0 overflow-y-auto">
                <Settings />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
