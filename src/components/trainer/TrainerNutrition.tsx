import { CalorieTracker } from "../CalorieTracker";
import { CalorieImport } from "../CalorieImport";
import { CalorieMigration } from "../CalorieMigration";
import { MacroNutritionCharts } from "../MacroNutritionCharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Apple } from "lucide-react";

export const TrainerNutrition = () => {
  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Výživa a Energie</h2>
            <p className="text-muted-foreground">
                Sledování kalorického příjmu a makroživin pro optimální výkon.
            </p>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Tracker */}
        <div className="md:col-span-2">
             <CalorieTracker />
        </div>

        {/* Macro Visualization Charts */}
        <div className="md:col-span-2">
             <MacroNutritionCharts />
        </div>

        {/* Import Tools */}
        <div className="md:col-span-2 space-y-6">
            <CalorieImport />
            <CalorieMigration />
        </div>

        {/* Info Card */}
        <div className="md:col-span-2">
            <Card className="bg-muted/30 border-dashed">
                <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                    <div className="p-2 w-fit rounded-lg bg-orange-500/10">
                        <Apple className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base">M.A.R.K. a Výživa</CardTitle>
                        <CardDescription>
                            Chytrý asistent nyní umí zapisovat jídla přímo sem.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    <p>
                        Stačí napsat: <strong>"Snědl jsem k obědu 150g kuřecího steaku s rýží"</strong> nebo <strong>"Zapiš mi banán"</strong>. 
                        Asistent automaticky odhadne kalorie (pomocí kaloricketabulky.cz databáze, kterou zná) a vytvoří záznam.
                    </p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};
