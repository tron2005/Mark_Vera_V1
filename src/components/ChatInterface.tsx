import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2, Image as ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
            // User messages přidáváme optimisticky v sendMessage – realtime přeskočit
            if ((payload.new as Message).role === "user") return;
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


  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Prosím vyberte obrázek");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendMessage = async (text: string, autoSpeak = false) => {
    if (!text.trim() && !selectedImage) return;

    setIsLoading(true);
    const userMessageContent = text.trim() || "📷 Fotka";
    const imageToSend = selectedImage;
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Zachytit historii PŘED přidáním optimistických zpráv
    const messagesForAI = [
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
        image_url: m.image_url,
      })),
      { role: "user", content: userMessageContent, image_url: imageToSend },
    ];

    // Přidat userMsg + tempAssistant DOHROMADY před DB insertem
    // Zabraňuje race condition: realtime by přidal userMsg AŽ PO tempAssistant
    const tempUserId = `temp-${crypto.randomUUID()}`;
    const tempAssistantId = `temp-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempUserId,
        role: "user" as const,
        content: userMessageContent,
        created_at: new Date().toISOString(),
        image_url: imageToSend || undefined,
      },
      {
        id: tempAssistantId,
        role: "assistant" as const,
        content: "",
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      // Uložit uživatelskou zprávu do DB (realtime pro user role přeskakujeme)
      const { error: userError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessageContent,
        image_url: imageToSend || null,
      });

      if (userError) throw userError;

      // Získat session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Nejste přihlášeni");
      }

      // Volání AI
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            messages: messagesForAI,
            mode,
            conversationId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Chyba při volání AI");
      }

      if (!response.body) {
        throw new Error("Prázdná odpověď");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";
      let streamDone = false;

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
            const content = parsed.choices?.[0]?.delta?.content as
              | string
              | undefined;

            if (content) {
              assistantContent += content;

              // Aktualizovat UI s novým obsahem
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === tempAssistantId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Neúplný JSON, vrátit řádek do bufferu
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Po dokončení streamu smazat dočasnou zprávu a nechat realtime subscription načíst finální
      setMessages((prev) => prev.filter((m) => m.id !== tempAssistantId));

      // Voice chat: automaticky přečíst odpověď
      if (autoSpeak && assistantContent) {
        await speakText(assistantContent);
      }
    } catch (error: any) {
      toast.error(error.message || "Chyba při odesílání zprávy");
      // Odstranit obě dočasné zprávy při chybě
      setMessages((prev) =>
        prev.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceChat = async () => {
    if (isRecording) {
      // Zastavit nahrávání → spustit přepis
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) {
          toast.error("Příliš krátká nahrávka, zkus to znovu");
          return;
        }

        setIsListening(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error("Nejste přihlášeni");

          const form = new FormData();
          form.append("audio", audioBlob, "audio.webm");

          const sttResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whisper-stt`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: form,
            }
          );

          if (!sttResponse.ok) throw new Error("STT chyba");
          const { text, error: sttError } = await sttResponse.json();
          if (sttError) throw new Error(sttError);
          if (!text?.trim()) {
            toast.error("Nic jsem neslyšel, zkus to znovu");
            return;
          }

          setIsListening(false);
          // Odeslat přepis jako zprávu + automaticky přečíst odpověď
          await sendMessage(text, true);
        } catch (err: any) {
          toast.error("Chyba přepisu: " + (err.message || "neznámá chyba"));
        } finally {
          setIsListening(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("🎙️ Nahrávám… klikni znovu pro odeslání");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast.error("Povolte přístup k mikrofonu v nastavení prohlížeče");
      } else {
        toast.error("Nelze spustit mikrofon: " + err.message);
      }
    }
  };

  // Mark = onyx (hluboký mužský), Vera = nova (přátelský ženský)
  const VOICE_MAP = { mark: "onyx", vera: "nova" } as const;

  const stopSpeech = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speakText = async (text: string) => {
    if (!text) return;
    // Pokud už hraje, zastav
    if (isSpeaking) { stopSpeech(); return; }

    // Zkrátit na max 500 znaků (úspora tokenů, rychlejší odpověď)
    const truncated = text.length > 500 ? text.substring(0, 500) + "…" : text;

    setIsSpeaking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Není přihlášen");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ text: truncated, voice: VOICE_MAP[mode] }),
        }
      );

      if (!response.ok) throw new Error("TTS chyba");
      const { audioContent } = await response.json();
      if (!audioContent) throw new Error("Prázdná audio odpověď");

      // Přehraj base64 MP3
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
      await audio.play();
    } catch (err: any) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
      toast.error(`Hlasový výstup selhal: ${err.message || "neznámá chyba"}`);
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
            <div className="flex flex-col gap-2">
              {msg.image_url && (
                <img 
                  src={msg.image_url} 
                  alt="Nahraný obrázek" 
                  className="max-w-full rounded-md"
                  style={{ maxHeight: "300px", objectFit: "contain" }}
                />
              )}
              <div className="flex items-start justify-between gap-2">
                {msg.role === "assistant" && !msg.content ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
                {msg.role === "assistant" && msg.content && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => speakText(msg.content)}
                    title={isSpeaking ? "Zastavit přehrávání" : `Přečíst hlasem ${mode === "mark" ? "M.A.R.K." : "V.E.R.A."}`}
                  >
                    {isSpeaking ? (
                      <VolumeX className="h-4 w-4 text-primary" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-card">
        {selectedImage && (
          <div className="mb-2 relative inline-block">
            <img 
              src={selectedImage} 
              alt="Náhled" 
              className="max-h-32 rounded-md border"
            />
            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={removeImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
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
            variant={isRecording ? "destructive" : "outline"}
            onClick={startVoiceChat}
            disabled={isListening || isLoading}
            title={isRecording ? "Zastavit a odeslat" : "Hlasová zpráva (Whisper)"}
          >
            {isRecording ? (
              <MicOff className="animate-pulse h-4 w-4" />
            ) : isListening ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <ImageIcon />
          </Button>
          
          <Input
            placeholder="Napište zprávu..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          
          <Button type="submit" size="icon" disabled={isLoading || (!input.trim() && !selectedImage)}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
};
