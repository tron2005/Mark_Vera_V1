import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Footprints, 
  Dumbbell, 
  Pill, 
  Clock, 
  Target, 
  Zap,
  BookOpen,
  Youtube,
  ExternalLink,
  Timer,
  Flame,
  Trophy,
  Heart
} from "lucide-react";
const runningGuides = [
  {
    distance: "5K",
    time: "25-30 min",
    icon: Timer,
    tips: [
      "Začněte pomalým tempem, první 2 km jako zahřátí",
      "Udržujte stabilní dechový rytmus (3:2 nebo 2:2)",
      "Poslední kilometr můžete zrychlit",
      "Trénujte intervalovky 400m pro rychlost"
    ],
    weeklyPlan: "3-4 běhy týdně: 1x intervaly, 1x tempo běh, 1-2x lehký běh",
    videos: [
      { title: "5K běžecká technika", url: "https://www.youtube.com/watch?v=brFHyOtTwH4" },
      { title: "Intervalový trénink", url: "https://www.youtube.com/watch?v=R8tFDN8_spQ" }
    ]
  },
  {
    distance: "10K",
    time: "50-60 min",
    icon: Flame,
    tips: [
      "Budujte základnu pomalými běhy 8-12 km",
      "Přidejte tempo běhy v závodním tempu",
      "Hydratace před a po tréninku je klíčová",
      "Trénujte kopce pro sílu nohou"
    ],
    weeklyPlan: "4-5 běhů týdně: 1x dlouhý běh, 1x intervaly, 1x tempo, 2x regenerační",
    videos: [
      { title: "10K tréninkový plán", url: "https://www.youtube.com/watch?v=9L2b2khySLE" },
      { title: "Tempo běhy vysvětlení", url: "https://www.youtube.com/watch?v=vcslaoxHdaE" }
    ]
  },
  {
    distance: "Půlmaraton",
    time: "1:45-2:15",
    icon: Heart,
    tips: [
      "Dlouhé běhy 16-20 km každý víkend",
      "Naučte se jíst a pít za běhu",
      "Testujte výživu před závodem",
      "Tapering 2 týdny před závodem"
    ],
    weeklyPlan: "5 běhů týdně: 1x dlouhý (16-22km), 1x tempo, 1x intervaly, 2x lehký",
    videos: [
      { title: "Půlmaraton příprava", url: "https://www.youtube.com/watch?v=3a3CW6cQG1o" },
      { title: "Výživa při běhu", url: "https://www.youtube.com/watch?v=JcPO2aOg2RY" }
    ]
  },
  {
    distance: "Maraton",
    time: "3:30-5:00",
    icon: Trophy,
    tips: [
      "Minimálně 16 týdnů přípravy",
      "Dlouhé běhy až 32 km",
      "Strategie výživy (gely, elektrolyty)",
      "Mentální příprava je polovinou úspěchu"
    ],
    weeklyPlan: "5-6 běhů týdně: celkem 50-80 km, včetně jednoho dlouhého běhu",
    videos: [
      { title: "Maraton kompletní průvodce", url: "https://www.youtube.com/watch?v=0Y87Xj6Zn80" },
      { title: "Mentální příprava", url: "https://www.youtube.com/watch?v=5tSTk1083VY" }
    ]
  }
];

const bodyCombatTracks = [
  { number: "1", name: "Warm-up", duration: "5 min", intensity: 3, description: "Zahřátí s jednoduchými údery a kopy" },
  { number: "2", name: "Combat 1", duration: "5 min", intensity: 7, description: "První bojová choreografie - údery" },
  { number: "3", name: "Power 1", duration: "4 min", intensity: 9, description: "Silové kombinace - maximální intenzita" },
  { number: "4", name: "Combat 2", duration: "5 min", intensity: 7, description: "Druhá bojová choreografie - kopy" },
  { number: "5", name: "Power 2", duration: "4 min", intensity: 9, description: "Další silová část s vysokou intenzitou" },
  { number: "6", name: "Combat 3", duration: "5 min", intensity: 7, description: "Kombinace úderů a kopů" },
  { number: "7", name: "Muay Thai", duration: "5 min", intensity: 8, description: "Thajský box - kolena a lokty" },
  { number: "8", name: "Power 3", duration: "4 min", intensity: 10, description: "Finální silová část - vše dáváte" },
  { number: "9", name: "Conditioning", duration: "4 min", intensity: 6, description: "Posilování core a nohou" },
  { number: "10", name: "Cool-down", duration: "4 min", intensity: 2, description: "Protažení a zklidnění" }
];

const exercises = [
  {
    category: "Core",
    icon: "🔥",
    items: [
      { name: "Plank", reps: "30-60s", description: "Základní pozice pro posílení středu těla", video: "https://www.youtube.com/watch?v=ASdvN_XEl_c" },
      { name: "Dead bug", reps: "10-15", description: "Střídavé natahování rukou a nohou v leže", video: "https://www.youtube.com/watch?v=I5xbsA71vxE" },
      { name: "Russian twist", reps: "20", description: "Rotace s váhou pro šikmé svaly", video: "https://www.youtube.com/watch?v=wkD8rjkodUI" },
      { name: "Mountain climbers", reps: "30s", description: "Dynamické posilování břicha", video: "https://www.youtube.com/watch?v=nmwgirgXLYM" }
    ]
  },
  {
    category: "Nohy",
    icon: "🦵",
    items: [
      { name: "Dřepy", reps: "15-20", description: "Základní cvik pro stehna a hýždě", video: "https://www.youtube.com/watch?v=aclHkVaku9U" },
      { name: "Výpady", reps: "12 na stranu", description: "Unilaterální síla nohou", video: "https://www.youtube.com/watch?v=QOVaHwm-Q6U" },
      { name: "Wall sit", reps: "45-60s", description: "Izometrická výdrž u zdi", video: "https://www.youtube.com/watch?v=y-wV4Venusw" },
      { name: "Calf raises", reps: "20-25", description: "Posilování lýtek", video: "https://www.youtube.com/watch?v=-M4-G8p8fmc" }
    ]
  },
  {
    category: "Horní tělo",
    icon: "💪",
    items: [
      { name: "Kliky", reps: "10-20", description: "Prsa, ramena, triceps", video: "https://www.youtube.com/watch?v=IODxDxX7oi4" },
      { name: "Pike push-ups", reps: "8-12", description: "Důraz na ramena", video: "https://www.youtube.com/watch?v=sposDXWEB0A" },
      { name: "Triceps dips", reps: "12-15", description: "Na židli nebo lavičce", video: "https://www.youtube.com/watch?v=6kALZikXxLc" },
      { name: "Superman", reps: "15", description: "Posilování zad v leže na břiše", video: "https://www.youtube.com/watch?v=z6PJMT2y8GQ" }
    ]
  }
];

const supplements = [
  {
    name: "Protein (Whey)",
    dosage: "20-30g po tréninku",
    timing: "Do 30 min po cvičení",
    purpose: "Regenerace a růst svalů",
    notes: "Lze nahradit jídlem bohatým na bílkoviny",
    category: "Základní"
  },
  {
    name: "Kreatin",
    dosage: "3-5g denně",
    timing: "Kdykoliv, ideálně po tréninku",
    purpose: "Síla a výkon při vysoké intenzitě",
    notes: "Jeden z nejvíce prozkoumaných suplementů",
    category: "Základní"
  },
  {
    name: "Omega-3",
    dosage: "1-3g EPA+DHA denně",
    timing: "S jídlem",
    purpose: "Protizánětlivé účinky, zdraví srdce",
    notes: "Preferujte rybí olej nebo řasy",
    category: "Zdraví"
  },
  {
    name: "Vitamin D",
    dosage: "1000-4000 IU denně",
    timing: "S tučným jídlem",
    purpose: "Imunita, kosti, svalová funkce",
    notes: "Důležitý zejména v zimě",
    category: "Zdraví"
  },
  {
    name: "Magnesium",
    dosage: "200-400mg před spaním",
    timing: "Večer",
    purpose: "Svalová relaxace, kvalita spánku",
    notes: "Citrate nebo glycinate formy",
    category: "Regenerace"
  },
  {
    name: "Kofein",
    dosage: "3-6mg/kg váhy",
    timing: "30-60 min před tréninkem",
    purpose: "Energie, výkon, soustředění",
    notes: "Netlačte po 14:00 kvůli spánku",
    category: "Výkon"
  },
  {
    name: "BCAA",
    dosage: "5-10g",
    timing: "Před/během tréninku",
    purpose: "Ochrana svalů při tréninku nalačno",
    notes: "Nepotřebné pokud jíte dostatek bílkovin",
    category: "Výkon"
  },
  {
    name: "Beta-Alanin",
    dosage: "2-5g denně",
    timing: "Kdykoliv (budování zásob)",
    purpose: "Vytrvalost při vysoké intenzitě",
    notes: "Může způsobit brnění kůže - normální",
    category: "Výkon"
  },
  {
    name: "Citrullin",
    dosage: "6-8g před tréninkem",
    timing: "30-60 min před",
    purpose: "Lepší prokrvení, výkon, pump",
    notes: "L-citruline malate preferovaná forma",
    category: "Výkon"
  },
  {
    name: "Vitamin C",
    dosage: "500-1000mg denně",
    timing: "Kdykoliv",
    purpose: "Imunita, antioxidant, vstřebávání železa",
    notes: "Zvýšit při nemoci nebo stresu",
    category: "Zdraví"
  },
  {
    name: "Zinek",
    dosage: "15-30mg denně",
    timing: "S jídlem",
    purpose: "Testosteron, imunita, regenerace",
    notes: "Důležitý pro sportovce - ztráty potem",
    category: "Zdraví"
  },
  {
    name: "Ashwagandha",
    dosage: "300-600mg denně",
    timing: "Ráno nebo večer",
    purpose: "Snížení kortizolu, adaptace na stres",
    notes: "KSM-66 nebo Sensoril extrakty",
    category: "Regenerace"
  },
  {
    name: "Kolagen",
    dosage: "10-15g denně",
    timing: "Kdykoliv, ideálně s vitaminem C",
    purpose: "Klouby, šlachy, kůže",
    notes: "Hydrolyzovaná forma pro lepší vstřebávání",
    category: "Regenerace"
  },
  {
    name: "Elektrolyty",
    dosage: "Dle potřeby při pocení",
    timing: "Během/po tréninku",
    purpose: "Hydratace, prevence křečí",
    notes: "Sodík, draslík, hořčík - důležité v létě",
    category: "Výkon"
  }
];

const supplementCategories = ["Základní", "Výkon", "Zdraví", "Regenerace"];

export const TrainingLibrary = () => {
  const [activeTab, setActiveTab] = useState("running");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Tréninková knihovna
        </CardTitle>
        <CardDescription>
          Průvodce běháním, cvičením a suplementací
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="running" className="flex items-center gap-1">
              <Footprints className="h-4 w-4" />
              <span className="hidden sm:inline">Běh</span>
            </TabsTrigger>
            <TabsTrigger value="bodycombat" className="flex items-center gap-1">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">BodyCombat</span>
            </TabsTrigger>
            <TabsTrigger value="exercises" className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              <span className="hidden sm:inline">Cviky</span>
            </TabsTrigger>
            <TabsTrigger value="supplements" className="flex items-center gap-1">
              <Pill className="h-4 w-4" />
              <span className="hidden sm:inline">Suplementy</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="running" className="mt-4 space-y-4">
            {runningGuides.map((guide) => {
              const IconComponent = guide.icon;
              return (
                <Card key={guide.distance} className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <IconComponent className="h-5 w-5 text-primary" />
                        {guide.distance}
                      </CardTitle>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {guide.time}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-1">
                      {guide.tips.map((tip, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                    <div className="bg-primary/10 p-2 rounded text-sm">
                      <strong>Týdenní plán:</strong> {guide.weeklyPlan}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {guide.videos.map((video, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="gap-2 text-xs"
                          onClick={() => window.open(video.url, "_blank")}
                        >
                          <Youtube className="h-3 w-3 text-red-500" />
                          {video.title}
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="bodycombat" className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Les Mills BodyCombat - 55 min lekce, 10 tracků, ~700-800 kcal
            </p>
            {bodyCombatTracks.map((track) => (
              <div
                key={track.number}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                  {track.number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{track.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {track.duration}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {track.description}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-4 rounded-full ${
                        i < track.intensity
                          ? track.intensity >= 9
                            ? "bg-red-500"
                            : track.intensity >= 7
                            ? "bg-orange-500"
                            : "bg-green-500"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="exercises" className="mt-4 space-y-4">
            {exercises.map((category) => (
              <Card key={category.category} className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{category.icon}</span>
                    {category.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {category.items.map((exercise) => (
                      <div
                        key={exercise.name}
                        className="flex items-center justify-between p-2 rounded bg-background/50 group hover:bg-background/80 transition-colors"
                      >
                        <div className="flex-1">
                          <span className="font-medium">{exercise.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {exercise.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{exercise.reps}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => window.open(exercise.video, "_blank")}
                          >
                            <Youtube className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="supplements" className="mt-4 space-y-4">
            {supplementCategories.map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    category === "Základní" ? "bg-blue-500" :
                    category === "Výkon" ? "bg-orange-500" :
                    category === "Zdraví" ? "bg-green-500" :
                    "bg-purple-500"
                  }`} />
                  {category}
                </h3>
                <div className="space-y-2">
                  {supplements.filter(s => s.category === category).map((supp) => (
                    <Card key={supp.name} className="bg-muted/30">
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{supp.name}</CardTitle>
                          <Badge variant="secondary">{supp.dosage}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Kdy:</span>{" "}
                            {supp.timing}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Proč:</span>{" "}
                            {supp.purpose}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                          💡 {supp.notes}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
