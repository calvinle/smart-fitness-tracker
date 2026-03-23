import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub({
  projectId: process.env.GCP_PROJECT_ID,
});

const TOPIC_NAME = 'workout-processed';

/**
 * Publish workout processed event to Pub/Sub
 * This triggers the choreographed phase (PR-Detector, Stats-Aggregator)
 */
export async function publishWorkoutProcessed(workoutId: string, userId: string): Promise<void> {
  try {
    const topic = pubsub.topic(TOPIC_NAME);
    
    const message = {
      workoutId,
      userId,
      timestamp: new Date().toISOString(),
      eventType: 'WORKOUT_PROCESSED',
    };
    
    const messageId = await topic.publishMessage({
      json: message,
    });
    
    console.log(`Published WORKOUT_PROCESSED event with message ID: ${messageId}`);
    console.log('Message payload:', message);
  } catch (error) {
    console.error('Error publishing to Pub/Sub:', error);
    // Don't throw - we don't want to fail the main workflow if pub/sub fails
    // The choreographed services are non-critical side effects
  }
}
