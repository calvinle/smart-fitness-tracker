import { Firestore, Timestamp } from '@google-cloud/firestore';
import logger from './logger';

/**
 * Firestore database client
 */
export const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  databaseId: 'workouts',
  // In production, service account credentials are automatically provided by Cloud Run
  // For local development, set GOOGLE_APPLICATION_CREDENTIALS environment variable
});

export interface WorkoutDocument {
  userId: string;
  date: string;
  bodyweight: number;
  exercises: Array<{
    name: string;
    category: string;
    weight: number;
    reps: number;
    sets: number;
    rpe?: number;
    notes?: string;
  }>;
  duration?: number;
  notes?: string;
  // Calculated fields
  totalLifted: number;
  dotsScore: number;
  wilksScore: number;
  estimatedOneRepMax: { [exerciseName: string]: number };
  volumeByCategory: { [category: string]: number };
  // Metadata
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Save workout to Firestore
 */
export async function saveWorkout(
  validatedData: any,
  calculatedScores: any
): Promise<{ id: string; workout: WorkoutDocument }> {
  const workoutDoc: Omit<WorkoutDocument, 'createdAt' | 'updatedAt'> = {
    ...validatedData,
    ...calculatedScores,
  };
  
  const docRef = await db.collection('workouts').add({
    ...workoutDoc,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  logger.info('Workout saved to Firestore', { workoutId: docRef.id, userId: validatedData.userId });
  
  const savedDoc = await docRef.get();
  return {
    id: docRef.id,
    workout: savedDoc.data() as WorkoutDocument,
  };
}

/**
 * Get user's workout history
 */
export async function getUserWorkouts(
  userId: string,
  limit: number = 50
): Promise<Array<{ id: string; workout: WorkoutDocument }>> {
  const snapshot = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    workout: doc.data() as WorkoutDocument,
  }));
}

/**
 * Get specific workout by ID
 */
export async function getWorkout(
  workoutId: string
): Promise<{ id: string; workout: WorkoutDocument } | null> {
  const doc = await db.collection('workouts').doc(workoutId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  return {
    id: doc.id,
    workout: doc.data() as WorkoutDocument,
  };
}

/**
 * Get user's personal records for each exercise
 */
export async function getPersonalRecords(
  userId: string
): Promise<{ [exerciseName: string]: { weight: number; date: string; workoutId: string } }> {
  const workouts = await getUserWorkouts(userId, 1000);
  const records: { [exerciseName: string]: { weight: number; date: string; workoutId: string } } = {};
  
  workouts.forEach(({ id, workout }) => {
    workout.exercises.forEach(exercise => {
      const key = exercise.name.toLowerCase();
      const current = records[key];
      
      if (!current || exercise.weight > current.weight) {
        records[key] = {
          weight: exercise.weight,
          date: workout.date,
          workoutId: id,
        };
      }
    });
  });
  
  return records;
}
