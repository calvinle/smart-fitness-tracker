import { Firestore, Timestamp } from '@google-cloud/firestore';
import logger from './logger';

const db = new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  databaseId: 'workouts',
});

export interface PersonalRecord {
  exerciseName: string;
  previousBest: number | null;
  newBest: number;
  improvement: number | null;
  improvementPercentage: number | null;
  isPR: boolean;
}

export interface PRDetectionResult {
  workoutId: string;
  userId: string;
  hasPersonalRecords: boolean;
  personalRecords: PersonalRecord[];
  notificationSent: boolean;
}

/**
 * Detect personal records by comparing new workout to historical data
 */
export async function detectPersonalRecords(
  workoutId: string,
  userId: string
): Promise<PRDetectionResult> {
  logger.info('Detecting personal records', { workoutId, userId });
  
  // Get the new workout
  const workoutDoc = await db.collection('workouts').doc(workoutId).get();
  
  if (!workoutDoc.exists) {
    throw new Error(`Workout ${workoutId} not found`);
  }
  
  const newWorkout = workoutDoc.data() as any;
  
  // Get all previous workouts for this user (excluding the current one)
  const previousWorkouts = await db
    .collection('workouts')
    .where('userId', '==', userId)
    .orderBy('date', 'desc')
    .limit(1000)
    .get();
  
  // Build a map of previous best for each exercise
  const previousBests: { [exerciseName: string]: number } = {};
  
  previousWorkouts.docs.forEach((doc) => {
    if (doc.id === workoutId) return; // Skip current workout
    
    const workout = doc.data();
    workout.exercises?.forEach((exercise: any) => {
      const name = exercise.name.toLowerCase();
      const weight = exercise.weight;
      
      if (!previousBests[name] || weight > previousBests[name]) {
        previousBests[name] = weight;
      }
    });
  });
  
  // Compare new workout exercises against previous bests
  const personalRecords: PersonalRecord[] = [];
  
  newWorkout.exercises?.forEach((exercise: any) => {
    const name = exercise.name.toLowerCase();
    const weight = exercise.weight;
    const previousBest = previousBests[name] || null;
    
    const isPR = previousBest === null || weight > previousBest;
    
    if (isPR && ['squat', 'bench', 'deadlift'].includes(exercise.category.toLowerCase())) {
      const improvement = previousBest ? weight - previousBest : null;
      const improvementPercentage = previousBest ? ((weight - previousBest) / previousBest) * 100 : null;
      
      personalRecords.push({
        exerciseName: exercise.name,
        previousBest,
        newBest: weight,
        improvement,
        improvementPercentage: improvementPercentage ? Math.round(improvementPercentage * 10) / 10 : null,
        isPR: true,
      });
    }
  });
  
  const hasPersonalRecords = personalRecords.length > 0;
  
  // Log PRs to Firestore for tracking
  if (hasPersonalRecords) {
    await db.collection('personalrecords').add({
      workoutId,
      userId,
      date: newWorkout.date,
      records: personalRecords,
      createdAt: Timestamp.now(),
    });
    
    logger.info('Personal records detected', { 
      workoutId, 
      userId,
      recordCount: personalRecords.length,
      records: personalRecords.map(pr => ({ exercise: pr.exerciseName, newBest: pr.newBest }))
    });
  }
  
  return {
    workoutId,
    userId,
    hasPersonalRecords,
    personalRecords,
    notificationSent: hasPersonalRecords, // In real app, would integrate with notification service
  };
}

/**
 * Send notification about personal record (mock implementation)
 */
export async function sendPRNotification(prResult: PRDetectionResult): Promise<void> {
  if (!prResult.hasPersonalRecords) {
    return;
  }
  
  // In a real application, this would integrate with:
  // - Firebase Cloud Messaging (FCM) for push notifications
  // - SendGrid/Mailgun for email
  // - Twilio for SMS
  
  const message = prResult.personalRecords
    .map((pr) => {
      if (pr.previousBest === null) {
        return `New ${pr.exerciseName} record: ${pr.newBest}kg! 🎉`;
      } else {
        return `New ${pr.exerciseName} PR: ${pr.newBest}kg (${pr.improvement}kg better, +${pr.improvementPercentage}%) 💪`;
      }
    })
    .join('\n');
  
  logger.info('New personal record notification', {
    userId: prResult.userId,
    workoutId: prResult.workoutId,
    records: prResult.personalRecords.map(pr => ({
      exercise: pr.exerciseName,
      newBest: pr.newBest,
      previousBest: pr.previousBest,
      improvement: pr.improvement
    }))
  });
  
  // Mock notification log
  await db.collection('notifications').add({
    userId: prResult.userId,
    type: 'PERSONAL_RECORD',
    title: 'New Personal Record! 🎉',
    message,
    workoutId: prResult.workoutId,
    read: false,
    createdAt: Timestamp.now(),
  });
}
