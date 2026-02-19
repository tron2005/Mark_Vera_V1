export interface MusclePart {
    id: string;
    name: string;
    path: string;
    view: 'front' | 'back';
}

export const MUSCLE_PATHS: MusclePart[] = [
    // --- FRONT VIEW ---
    // Hrudník (Chest) - Levá/Pravá deska
    { id: 'chest', name: 'Hrudník', view: 'front', path: 'M 70 65 L 100 70 L 130 65 L 125 90 L 100 95 L 75 90 Z' },
    
    // Ramena (Shoulders) - Hexagonální chrániče
    { id: 'shoulders', name: 'Ramena', view: 'front', path: 'M 40 60 L 65 55 L 70 75 L 55 90 L 35 80 Z M 160 60 L 135 55 L 130 75 L 145 90 L 165 80 Z' },

    // Břicho (Core) - Segmentované "cihličky"
    { id: 'core', name: 'Břicho', view: 'front', path: 'M 85 100 L 115 100 L 112 115 L 88 115 Z M 88 118 L 112 118 L 110 133 L 90 133 Z M 90 136 L 110 136 L 108 150 L 92 150 Z' },

    // Bicepsy (Biceps) - Bloky na pažích
    { id: 'biceps', name: 'Bicepsy', view: 'front', path: 'M 55 95 L 70 95 L 65 125 L 50 120 Z M 145 95 L 130 95 L 135 125 L 150 120 Z' },

    // Předloktí (Forearms)
    { id: 'forearms', name: 'Předloktí', view: 'front', path: 'M 45 125 L 60 128 L 55 160 L 40 155 Z M 155 125 L 140 128 L 145 160 L 160 155 Z' },

    // Stehna (Quads) - Velké pláty
    { id: 'quads', name: 'Stehna', view: 'front', path: 'M 75 160 L 100 165 L 95 230 L 70 225 Z M 125 160 L 100 165 L 105 230 L 130 225 Z' },

    // Lýtka (Calves) - Diamanty
    { id: 'calves', name: 'Lýtka', view: 'front', path: 'M 75 235 L 95 240 L 90 280 L 75 270 Z M 125 235 L 105 240 L 110 280 L 125 270 Z' },


    // --- BACK VIEW ---
    // Trapézy (Traps) - Kosočtverec nahoře
    { id: 'traps', name: 'Trapézy', view: 'back', path: 'M 85 55 L 115 55 L 100 80 Z' },

    // Záda (Lats) - Křídla
    { id: 'lats', name: 'Široký sval zádový', view: 'back', path: 'M 70 80 L 100 90 L 130 80 L 120 130 L 100 140 L 80 130 Z' },

    // Ramena (Shoulders Back)
    { id: 'shoulders', name: 'Ramena', view: 'back', path: 'M 40 60 L 65 55 L 70 75 L 55 90 L 35 80 Z M 160 60 L 135 55 L 130 75 L 145 90 L 165 80 Z' },

    // Tricepsy (Triceps)
    { id: 'triceps', name: 'Tricepsy', view: 'back', path: 'M 50 90 L 65 95 L 60 120 L 45 115 Z M 150 90 L 135 95 L 140 120 L 155 115 Z' },
    
    // Spodní záda (Low Back)
    { id: 'low_back', name: 'Vzpřimovače', view: 'back', path: 'M 85 135 L 115 135 L 110 155 L 90 155 Z' },

    // Hýždě (Glutes)
    { id: 'glutes', name: 'Hýždě', view: 'back', path: 'M 75 160 L 100 165 L 95 190 L 70 185 Z M 125 160 L 100 165 L 105 190 L 130 185 Z' },

    // Hamstringy (Hamstrings)
    { id: 'hamstrings', name: 'Hamstringy', view: 'back', path: 'M 75 195 L 95 200 L 90 235 L 70 230 Z M 125 195 L 105 200 L 110 235 L 130 230 Z' },

    // Lýtka (Calves Back)
    { id: 'calves', name: 'Lýtka', view: 'back', path: 'M 75 240 L 95 245 L 90 285 L 75 275 Z M 125 240 L 105 245 L 110 285 L 125 275 Z' }
];

export const MUSCLE_ACTIVITY_MAP: Record<string, string[]> = {
    chest: ["WeightTraining", "Workout", "BodyCombat"],
    back: ["WeightTraining", "Workout", "Rowing", "Swim"],
    lats: ["WeightTraining", "Workout", "Rowing", "Swim"],
    traps: ["WeightTraining", "Workout"],
    low_back: ["WeightTraining", "Run", "Ride"],
    shoulders: ["WeightTraining", "Workout", "BodyCombat", "Swim"],
    biceps: ["WeightTraining", "Workout", "BodyCombat"],
    triceps: ["WeightTraining", "Workout", "BodyCombat"],
    forearms: ["WeightTraining", "Workout", "Climb"],
    core: ["WeightTraining", "Workout", "BodyCombat", "Run", "Ride", "Yoga"],
    quads: ["Run", "Ride", "Walk", "Hike", "WeightTraining", "BodyCombat"],
    hamstrings: ["Run", "Ride", "Walk", "Hike", "WeightTraining"],
    glutes: ["Run", "Ride", "Walk", "Hike", "WeightTraining", "BodyCombat"],
    calves: ["Run", "Walk", "Hike", "Ride"],
};
