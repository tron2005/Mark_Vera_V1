import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  { text: "Každý krok tě přibližuje k cíli!", author: "Tvůj trenér" },
  { text: "Bolest je dočasná, hrdost je věčná.", author: "Neznámý" },
  { text: "Nejlepší trénink je ten, který uděláš.", author: "Tvůj trenér" },
  { text: "Nepřestaň, dokud na sebe nebudeš pyšný.", author: "Neznámý" },
  { text: "Silnější jsi, než si myslíš.", author: "Tvůj trenér" },
  { text: "Dnes je ten den, kdy se posouváš dál.", author: "Tvůj trenér" },
  { text: "Výsledky přicházejí s konzistencí.", author: "Neznámý" },
  { text: "Tvoje tělo dokáže víc, než si myslíš.", author: "Tvůj trenér" },
  { text: "Každý mistr byl jednou začátečník.", author: "Neznámý" },
  { text: "Netrénuj, dokud to nepůjde. Trénuj, dokud to nebudeš umět.", author: "Neznámý" },
  { text: "Únava je jen stav mysli.", author: "Tvůj trenér" },
  { text: "Překonávej sám sebe, ne ostatní.", author: "Neznámý" },
  { text: "Disciplína je most mezi cíli a jejich dosažením.", author: "Jim Rohn" },
  { text: "Pot je jen tvůj tuk, který pláče.", author: "Neznámý" },
  { text: "Síla nepochází z fyzické kapacity. Pochází z neústupné vůle.", author: "Mahátma Gándhí" },
  { text: "Nejhorší trénink je ten, který se neuskutečnil.", author: "Tvůj trenér" },
  { text: "Nevzdávej se. Začátky jsou vždy nejtěžší.", author: "Neznámý" },
  { text: "Tvá jediná limitace jsi ty sám.", author: "Tvůj trenér" },
  { text: "Udělej dnes to, co ostatní nechtějí. Zítra budeš mít to, co ostatní nemají.", author: "Neznámý" },
  { text: "Běhání je nejlevnější terapie.", author: "Tvůj trenér" },
];

export const MotivationalQuote = () => {
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Select random quote on mount
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    setQuote(MOTIVATIONAL_QUOTES[randomIndex]);
  }, []);

  const getNewQuote = () => {
    setIsAnimating(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
      setQuote(MOTIVATIONAL_QUOTES[randomIndex]);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div 
      onClick={getNewQuote}
      className="group relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 border border-primary/20 cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className={`flex-1 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-base font-medium italic text-foreground">
            "{quote.text}"
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            — {quote.author}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        Klikni pro další motivaci
      </p>
    </div>
  );
};
