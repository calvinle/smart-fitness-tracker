import { Firestore } from '@google-cloud/firestore';

const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
});

export interface UserStats {
  userId: string;
  totalWorkouts: number;
  totalVolume: number;
  totalLifted: number;
  averageDotsScore: number;
  bestDotsScore: number;
  volumeByCategory: { [category: string]: number };
  exerciseFrequency: { [exerciseName: string]: number };
  recentWorkouts: number; // Last 30 days
  consistency: number; // Workouts per week average
  lastUpdated: FirebaseFirestore.Timestamp;
}

/**
 * Aggregate user statistics from all workouts
 * This is computationally expensive and runs asynchronously via Cloud Tasks
 */
export async function aggregateUserStats(userId: string): Promise<UserStats> {
  console.log(`Aggregating stats for user: ${userId}`);
  
  const startTime = Date.now();
  
  // Get all workouts for the user
  const workouts = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(1000)
    .get();
  
  console.log(`Found ${workouts.size} workouts for user ${userId}`);
  
  // Initialize aggregators
  let totalVolume = 0;
  let totalLifted = 0;
  let totalDotsScore = 0;
  let bestDotsScore = 0;
  const volumeByCategory: { [category: string]: number } = {};
  const exerciseFrequency: { [exerciseName: string]: number } = {};
  
  // Calculate date 30 days ago for recent workouts
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  let recentWorkouts = 0;
  
  // Find earliest workout date for consistency calculation
  let earliestDate: Date | null = null;
  
  // Aggregate data
  workouts.docs.forEach((doc) => {
    const workout = doc.data();
    
    // Update totals
    totalLifted += workout.totalLifted || 0;
    totalDotsScore += workout.dotsScore || 0;
    
    if (workout.dotsScore > bestDotsScore) {
      bestDotsScore = workout.dotsScore;
    }
    
    // Aggregate volume by category
    if (workout.volumeByCategory) {
      Object.entries(workout.volumeByCategory).forEach(([category, volume]) => {
        volumeByCategory[category] = (volumeByCategory[category] || 0) + (volume as number);
        totalVolume += volume as number;
      });
    }
    
    // Count exercise frequency
    workout.exercises?.forEach((exercise: any) => {
      const name = exercise.name;
      exerciseFrequency[name] = (exerciseFrequency[name] || 0) + 1;
    });
    
    // Check if recent workout
    const workoutDate = new Date(workout.date);
    if (workoutDate >= thirtyDaysAgo) {
      recentWorkouts++;
    }
    
    // Track earliest date
    if (!earliestDate || workoutDate < earliestDate) {
      earliestDate = workoutDate;
    }
  });
  
  const totalWorkouts = workouts.size;
  const averageDotsScore = totalWorkouts > 0 ? totalDotsScore / totalWorkouts : 0;
  
  // Calculate consistency (workouts per week)
  let consistency = 0;
  if (earliestDate && totalWorkouts > 0) {
    const daysSinceFirst = (Date.now() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
    const weeksSinceFirst = daysSinceFirst / 7;
    consistency = weeksSinceFirst > 0 ? totalWorkouts / weeksSinceFirst : 0;
  }
  
  const stats: UserStats = {
    userId,
    totalWorkouts,
    totalVolume: Math.round(totalVolume),
    totalLifted: Math.round(totalLifted),
    averageDotsScore: Math.round(averageDotsScore * 100) / 100,
    bestDotsScore: Math.round(bestDotsScore * 100) / 100,
    volumeByCategory,
    exerciseFrequency,
    recentWorkouts,
    consistency: Math.round(consistency * 100) / 100,
    lastUpdated: Firestore.Timestamp.now(),
  };
  
  // Save aggregated stats to Firestore
  await db.collection('user-stats').doc(userId).set(stats);
  
  const duration = Date.now() - startTime;
  console.log(`Stats aggregation completed for user ${userId} in ${duration}ms`);
  
  return stats;
}

/**
 * Get cached user stats
 */
export async function getCachedUserStats(userId: string): Promise<UserStats | null> {
  const doc = await db.collection('user-stats').doc(userId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return doc.data() as UserStats;
}
