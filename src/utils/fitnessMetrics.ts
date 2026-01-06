import { differenceInDays, subDays, isSameDay } from "date-fns";

export interface Activity {
  id: string;
  start_date: string;
  distance: number; // meters
  moving_time: number; // seconds
  average_heartrate?: number;
  max_heartrate?: number;
  type: string;
  calories?: number;
}

export interface DailyMetric {
  date: Date;
  trimp: number;
  ctl: number;
  atl: number;
  tsb: number;
  monotony: number;
  strain: number;
}

export interface FitnessMetrics {
  currentCTL: number;
  currentATL: number;
  currentTSB: number;
  currentVO2max: number;
  monotony: number;
  trainingStrain: number;
  marathonShape: number; // Percentage
  history: DailyMetric[];
}

// Default values if user profile is missing
const DEFAULT_MAX_HR = 190;
const DEFAULT_RESTING_HR = 60;

/**
 * Calculates TRIMP (Training Impulse) for a single activity
 * Formula based on Bannister's TRIMP
 */
export const calculateTRIMP = (
  activity: Activity,
  userMaxHR: number = DEFAULT_MAX_HR,
  userRestingHR: number = DEFAULT_RESTING_HR,
  userGender: 'male' | 'female' = 'male'
): number => {
  if (!activity.average_heartrate || !activity.moving_time) return 0;

  const durationMin = activity.moving_time / 60;
  const hrReserve = userMaxHR - userRestingHR;
  const hrAvgReserve = activity.average_heartrate - userRestingHR;
  const intensity = Math.max(0, hrAvgReserve / hrReserve);
  
  // Gender factor from Bannister
  const genderFactor = userGender === 'male' ? 1.92 : 1.67;
  
  // Basic exponential TRIMP
  const trimp = durationMin * intensity * 0.64 * Math.exp(genderFactor * intensity);
  
  return Math.round(trimp);
};

/**
 * Calculates rolling metrics (ATL, CTL, TSB)
 */
export const calculateFitnessMetrics = (
  activities: Activity[],
  userMaxHR?: number,
  userRestingHR?: number,
  userGender: 'male' | 'female' = 'male'
): FitnessMetrics => {
  if (!activities.length) {
    return {
      currentCTL: 0,
      currentATL: 0,
      currentTSB: 0,
      currentVO2max: 0,
      monotony: 0,
      trainingStrain: 0,
      marathonShape: 0,
      history: []
    };
  }

  // 1. Sort activities by date
  const sortedActivities = [...activities].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  const endDate = new Date();
  // Ensure we cover at least 42 days of history to build up CTL
  const startDate = subDays(endDate, 60); 
  
  // 2. Aggregate TRIMPs per day
  const dailyTrimps: Map<string, number> = new Map();
  
  sortedActivities.forEach(activity => {
    const dateStr = new Date(activity.start_date).toISOString().split('T')[0];
    const trimp = calculateTRIMP(activity, userMaxHR, userRestingHR, userGender);
    dailyTrimps.set(dateStr, (dailyTrimps.get(dateStr) || 0) + trimp);
  });

  // 3. Calculate rolling averages
  const history: DailyMetric[] = [];
  let currentCTL = 0; // Starts at 0, builds up
  let currentATL = 0;
  
  // Time constants
  const ctlDecay = 42; // Fitness
  const atlDecay = 7;  // Fatigue

  // Iterate day by day
  for (let d = 0; d <= 60; d++) {
    const currentDate = subDays(endDate, 60 - d);
    const dateStr = currentDate.toISOString().split('T')[0];
    const dailyLoad = dailyTrimps.get(dateStr) || 0;

    // Exponential Weighted Moving Average
    currentCTL = dailyLoad * (1 / ctlDecay) + currentCTL * (1 - 1 / ctlDecay);
    currentATL = dailyLoad * (1 / atlDecay) + currentATL * (1 - 1 / atlDecay);
    const currentTSB = currentCTL - currentATL;

    // Monotony & Strain (Calculation over last 7 days)
    // Need a window of loads
    // Simplified for now: Monotony 7 days
    
    history.push({
      date: currentDate,
      trimp: dailyLoad,
      ctl: Math.round(currentCTL),
      atl: Math.round(currentATL),
      tsb: Math.round(currentTSB),
      monotony: 0, // Placeholder
      strain: 0 // Placeholder
    });
  }

  // 4. Calculate Monotony & Strain for the last 7 days
  const last7Days = history.slice(-7);
  const avgLoad = last7Days.reduce((sum, day) => sum + day.trimp, 0) / 7;
  // Standard deviation
  const variance = last7Days.reduce((sum, day) => sum + Math.pow(day.trimp - avgLoad, 2), 0) / 7;
  const stdDev = Math.sqrt(variance);
  
  // Avoid division by zero
  const monotony = stdDev > 0 ? avgLoad / stdDev : 0;
  const strain = avgLoad * monotony;

  // 5. Estimate VO2max (Cooper test logic approximation)
  // Find best recent effort (e.g. max distance in 12 min or fastest 5k)
  // Simplified Logic: running Index based on HR/Speed relation
  let vo2maxSum = 0;
  let vo2maxCount = 0;
  
  sortedActivities.slice(-10).forEach(act => {
    if (act.type === 'Run' && act.average_heartrate && act.distance > 2000) {
       // Very rough estimation formula
       // VO2 = (Distance - 504.9) / 44.73
       // Adjusted for HR intensity
       const pace = (act.moving_time / 60) / (act.distance / 1000); // min/km
       const speedKmh = (act.distance / 1000) / (act.moving_time / 3600);
       
       if (speedKmh > 6) { // Filter out walks
           // Relation: %HR Max vs %VO2 Max
           const hrPercent = act.average_heartrate / (userMaxHR || DEFAULT_MAX_HR);
           // Inverse estimation: If running at X speed with Y HR, what is max?
           // ACMS metabolic equation: VO2 = 3.5 + (0.2 * speed_m_min) + (0.9 * speed_m_min * grade)
           const speedMmin = act.distance / (act.moving_time / 60);
           const estimatedVO2cost = 3.5 + (0.2 * speedMmin);
           
           // If we assume linear relation: %VO2 ~= %HR (roughly above 60%)
           // Actually %VO2max ~= (%HRmax - 37) / 0.64 (generic)
           const percentVo2Max = (hrPercent * 100 - 37) / 0.64; // Approximation
           
           if (percentVo2Max > 40 && percentVo2Max < 100) {
               const inferredVo2Max = (estimatedVO2cost / percentVo2Max) * 100;
               vo2maxSum += inferredVo2Max;
               vo2maxCount++;
           }
       }
    }
  });

  const currentVO2max = vo2maxCount > 0 ? Math.round(vo2maxSum / vo2maxCount) : 35; // Default fallback

  // 6. Marathon Shape
  // Based on Long Run capability + Weekly distance
  // Simplified Score 0-100%
  const weeklyDistkm = avgLoad * 7 / 20; // Rough conversion back from TRIMP to distance equivalent?
  // Let's use CTL as proxy. CTL 100+ -> 100% shape.
  const marathonShape = Math.min(100, Math.round((currentCTL / 100) * 100));

  return {
    currentCTL: Math.round(currentCTL),
    currentATL: Math.round(currentATL),
    currentTSB: Math.round(currentCTL - currentATL),
    currentVO2max,
    monotony: Math.round(monotony * 10) / 10,
    trainingStrain: Math.round(strain),
    marathonShape,
    history
  };
};
