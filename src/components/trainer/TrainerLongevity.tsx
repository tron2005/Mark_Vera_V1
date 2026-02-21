import { LongevityCard } from "../LongevityCard";
import { BloodPressureWidget } from "./BloodPressureWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hourglass, HeartPulse, Dna } from "lucide-react";

export const TrainerLongevity = () => {
  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Dlouhověkost & Zdraví</h2>
            <p className="text-muted-foreground">
                Pokročilé metriky biologického věku a predikce zdraví.
            </p>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Krevní tlak */}
        <div className="md:col-span-2">
          <BloodPressureWidget />
        </div>

        {/* Main Longevity Card */}
        <div className="md:col-span-2">
             <LongevityCard />
        </div>

        {/* Future Placeholders / Education */}
        <Card className="bg-muted/30 border-dashed">
            <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="p-2 w-fit rounded-lg bg-blue-500/10">
                    <HeartPulse className="h-6 w-6 text-blue-500" />
                </div>
                <CardTitle className="text-base">VO2max & Zdraví</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                <p>
                   Vaše VO2max je klíčovým ukazatelem dlouhověkosti. 
                   Sledujte jej v kartě Výkon pro zlepšení vašeho biologického věku.
                </p>
            </CardContent>
        </Card>

         <Card className="bg-muted/30 border-dashed">
            <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                <div className="p-2 w-fit rounded-lg bg-purple-500/10">
                    <Dna className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle className="text-base">Genetika & Životní styl</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
                <p>
                   Dlouhověkost je z 20% genetika a z 80% životní styl.
                   Kvalitní spánek a strava (karta Výživa) jsou vaším nejlepším lékem.
                </p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};
