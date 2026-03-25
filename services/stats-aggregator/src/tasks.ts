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
  // In production, this MUST be set to the actual Cloud Run service URL
  const serviceUrl = process.env.SERVICE_URL;
  
  if (!serviceUrl) {
    const error = 'SERVICE_URL environment variable is required for Cloud Tasks. Set it to your Cloud Run service URL (e.g., https://stats-aggregator-xxx-uc.a.run.app)';
    logger.error(error);
    throw new Error(error);
  }
  
  const parent = client.queuePath(project!, location, queue);
  
  // Prepare OIDC token for authentication to Cloud Run service
  // If SERVICE_ACCOUNT_EMAIL is not set, Cloud Tasks will use the default compute service account
  // K_SERVICE is automatically set by Cloud Run
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
  const oidcToken = isProduction
    ? {
        serviceAccountEmail: process.env.SERVICE_ACCOUNT_EMAIL || undefined,
      }
    : undefined;
  
  const task = {
    httpRequest: {
      httpMethod: 'POST' as const,
      url: `${serviceUrl}/aggregate`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      ...(oidcToken && { oidcToken }),
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
