/**
 * Performance score calculations for powerlifting
 * Implements DOTS and Wilks formulas
 */

export interface Exercise {
  name: string;
  category: string;
  weight: number;
  reps: number;
  sets: number;
}

export interface CalculationInput {
  bodyweight: number;
  gender?: 'male' | 'female';
  exercises: Exercise[];
}

export interface CalculationResult {
  totalLifted: number;
  dotsScore: number;
  wilksScore: number;
  estimatedOneRepMax: { [exerciseName: string]: number };
  volumeByCategory: { [category: string]: number };
}

/**
 * Calculate DOTS score
 * DOTS (Dots Performance Points) is a powerlifting scoring system
 */
export function calculateDOTS(bodyweightKg: number, totalKg: number, gender: 'male' | 'female' = 'male'): number {
  // DOTS coefficients (simplified version)
  const coefficients = gender === 'male' 
    ? { a: -0.000001093, b: 0.0007391293, c: -0.1918759221, d: 24.0900756, e: -307.75076 }
    : { a: -0.0000010706, b: 0.0005158568, c: -0.1126655495, d: 13.6175032, e: -57.96288 };
  
  const { a, b, c, d, e } = coefficients;
  const bw = bodyweightKg;
  
  const denominator = a * Math.pow(bw, 4) + b * Math.pow(bw, 3) + c * Math.pow(bw, 2) + d * bw + e;
  const dotsScore = (500 / denominator) * totalKg;
  
  return Math.round(dotsScore * 100) / 100;
}

/**
 * Calculate Wilks score
 * Wilks coefficient is another powerlifting formula
 */
export function calculateWilks(bodyweightKg: number, totalKg: number, gender: 'male' | 'female' = 'male'): number {
  // Wilks coefficients
  const coefficients = gender === 'male'
    ? { a: -216.0475144, b: 16.2606339, c: -0.002388645, d: -0.00113732, e: 7.01863e-6, f: -1.291e-8 }
    : { a: 594.31747775582, b: -27.23842536447, c: 0.82112226871, d: -0.00930733913, e: 4.731582e-5, f: -9.054e-8 };
  
  const { a, b, c, d, e, f } = coefficients;
  const bw = bodyweightKg;
  
  const denominator = a + b * bw + c * Math.pow(bw, 2) + d * Math.pow(bw, 3) + e * Math.pow(bw, 4) + f * Math.pow(bw, 5);
  const wilksScore = (500 / denominator) * totalKg;
  
  return Math.round(wilksScore * 100) / 100;
}

/**
 * Estimate one-rep max using Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  const oneRepMax = weight * (1 + reps / 30);
  return Math.round(oneRepMax * 100) / 100;
}

/**
 * Calculate total volume (sets × reps × weight)
 */
export function calculateVolume(exercise: Exercise): number {
  return exercise.sets * exercise.reps * exercise.weight;
}

/**
 * Main calculation function
 */
export function calculateScores(input: CalculationInput): CalculationResult {
  const { bodyweight, gender = 'male', exercises } = input;
  
  // Calculate total lifted for main lifts (squat, bench, deadlift)
  const mainLifts = exercises.filter(ex => 
    ['squat', 'bench', 'deadlift'].includes(ex.category.toLowerCase())
  );
  
  // Estimate 1RM for each exercise
  const estimatedOneRepMax: { [name: string]: number } = {};
  let totalLifted = 0;
  
  mainLifts.forEach(exercise => {
    const oneRM = estimateOneRepMax(exercise.weight, exercise.reps);
    estimatedOneRepMax[exercise.name] = oneRM;
    totalLifted += oneRM;
  });
  
  // Calculate DOTS and Wilks
  const dotsScore = calculateDOTS(bodyweight, totalLifted, gender);
  const wilksScore = calculateWilks(bodyweight, totalLifted, gender);
  
  // Calculate volume by category
  const volumeByCategory: { [category: string]: number } = {};
  exercises.forEach(exercise => {
    const category = exercise.category;
    const volume = calculateVolume(exercise);
    volumeByCategory[category] = (volumeByCategory[category] || 0) + volume;
  });
  
  return {
    totalLifted,
    dotsScore,
    wilksScore,
    estimatedOneRepMax,
    volumeByCategory,
  };
}
