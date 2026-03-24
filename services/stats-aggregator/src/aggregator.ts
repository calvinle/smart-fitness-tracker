import { Firestore, Timestamp } from '@google-cloud/firestore';
import logger from './logger';

const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  databaseId: 'workouts',
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
  lastUpdated: Timestamp;
}

/**
 * Aggregate user statistics from all workouts
 * This is computationally expensive and runs asynchronously via Cloud Tasks
 */
export async function aggregateUserStats(userId: string): Promise<UserStats> {
  logger.info('Starting stats aggregation', { userId });
  
  const startTime = Date.now();
  
  // Get all workouts for the user
  const workouts = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(1000)
    .get();
  
  logger.debug('Retrieved workouts for aggregation', { userId, workoutCount: workouts.size });
  
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
    const daysSinceFirst = (Date.now() - (earliestDate as Date).getTime()) / (1000 * 60 * 60 * 24);
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
    lastUpdated: Timestamp.now(),
  };
  
  // Save aggregated stats to Firestore
  await db.collection('user-stats').doc(userId).set(stats);
  
  const duration = Date.now() - startTime;
  logger.info('Stats aggregation completed', { 
    userId, 
    duration: `${duration}ms`,
    totalWorkouts: stats.totalWorkouts,
    totalVolume: stats.totalVolume
  });
  
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
