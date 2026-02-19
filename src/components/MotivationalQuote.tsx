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
      className="hero-gradient group relative overflow-hidden rounded-xl p-5 cursor-pointer transition-all duration-300 hover:shadow-lg animate-fade-in"
    >
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-purple-500/5 translate-y-1/2 -translate-x-1/2" />

      <div className="flex items-start gap-3 relative z-10">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className={`flex-1 transition-all duration-300 ${isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <p className="text-base font-medium italic text-foreground leading-relaxed">
            <span>"{quote.text}"</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">
            <span>— {quote.author}</span>
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
        <span>Klikni pro další motivaci ✨</span>
      </p>
    </div>
  );
};
