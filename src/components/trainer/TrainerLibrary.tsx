import { TrainingLibrary } from "../TrainingLibrary";

export const TrainerLibrary = () => {
  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Tréninková Knihovna</h2>
            <p className="text-muted-foreground">
                Databáze cvičení, běžeckých plánů a suplementačních průvodců.
            </p>
        </div>

      {/* Main Content */}
      <TrainingLibrary />
    </div>
  );
};
