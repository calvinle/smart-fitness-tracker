import { CloudTasksClient } from '@google-cloud/tasks';
import logger from './logger';

const client = new CloudTasksClient();

interface TaskPayload {
  userId: string;
  workoutId: string;
  timestamp: string;
}

/**
 * Create a Cloud Task to aggregate stats in the background
 * This allows the main workflow to complete without waiting for time-consuming aggregation
 */
export async function createAggregationTask(payload: TaskPayload): Promise<string> {
  const project = process.env.GCP_PROJECT_ID;
  const location = process.env.GCP_REGION || 'us-central1';
  const queue = process.env.CLOUD_TASKS_QUEUE || 'stats-aggregation-queue';
  
  // The service URL where this Cloud Run service is deployed
  const serviceUrl = process.env.SERVICE_URL || 'http://localhost:8084';
  
  const parent = client.queuePath(project!, location, queue);
  
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${serviceUrl}/aggregate`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      oidcToken: process.env.NODE_ENV === 'production' 
        ? {
            serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL,
          }
        : undefined,
    },
    scheduleTime: {
      seconds: Math.floor(Date.now() / 1000) + 5, // Schedule 5 seconds from now
    },
  };
  
  try {
    const [response] = await client.createTask({ parent, task });
    logger.info('Created Cloud Task', { taskName: response.name, userId: payload.userId });
    return response.name!;
  } catch (error) {
    logger.error('Error creating Cloud Task', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: payload.userId
    });
    throw error;
  }
}
