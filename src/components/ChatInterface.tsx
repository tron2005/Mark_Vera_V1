import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Send, Volume2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type ChatInterfaceProps = {
  conversationId: string;
  mode: "mark" | "vera";
};

export const ChatInterface = ({ conversationId, mode }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Realtime subscription
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Chyba načítání zpráv");
      return;
    }

    setMessages((data || []) as Message[]);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    setIsLoading(true);
    const userMessageContent = text.trim();
    setInput("");

    try {
      // Uložit uživatelskou zprávu
      const { error: userError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessageContent,
      });

      if (userError) throw userError;

      // Volání AI
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              { role: "user", content: userMessageContent },
            ],
            mode,
          }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Chyba při volání AI");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      let streamDone = false;
      let assistantMessageId: string | null = null;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            
            if (content) {
              assistantContent += content;
              
              // Aktualizovat nebo vytvořit zprávu asistenta
              if (!assistantMessageId) {
                const { data, error } = await supabase
                  .from("messages")
                  .insert({
                    conversation_id: conversationId,
                    role: "assistant",
                    content: assistantContent,
                  })
                  .select()
                  .single();

                if (error) throw error;
                assistantMessageId = data.id;
              } else {
                await supabase
                  .from("messages")
                  .update({ content: assistantContent })
                  .eq("id", assistantMessageId);
              }
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Chyba při odesílání zprávy");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window)) {
      toast.error("Rozpoznávání řeči není podporováno v tomto prohlížeči");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "cs-CZ";
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Poslouchám...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Chyba při rozpoznávání řeči");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "cs-CZ";
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Badge variant={mode === "vera" ? "default" : "secondary"}>
            {mode === "vera" ? "🤖 V.E.R.A." : "🔧 M.A.R.K."}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <Card
            key={msg.id}
            className={`p-4 max-w-[80%] ${
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{msg.content}</p>
              {msg.role === "assistant" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => speakText(msg.content)}
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}
        {isLoading && (
          <Card className="p-4 max-w-[80%] mr-auto bg-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
          </Card>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleVoiceInput}
            disabled={isListening || isLoading}
          >
            <Mic className={isListening ? "animate-pulse" : ""} />
          </Button>
          
          <Input
            placeholder="Napište zprávu..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
};
