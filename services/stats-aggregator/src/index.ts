import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createAggregationTask } from './tasks';
import { aggregateUserStats, getCachedUserStats } from './aggregator';

const app = express();
const PORT = process.env.PORT || 8084;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'stats-aggregator' });
});

/**
 * POST /pubsub
 * Pub/Sub push endpoint
 * Receives WORKOUT_PROCESSED events and creates Cloud Tasks
 */
app.post('/pubsub', async (req: Request, res: Response) => {
  try {
    console.log('Received Pub/Sub message for stats aggregation');
    
    const message = req.body.message;
    
    if (!message || !message.data) {
      console.log('Invalid Pub/Sub message format');
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    // Decode base64 message data
    const messageData = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );
    
    console.log('Decoded message:', messageData);
    
    const { workoutId, userId, eventType, timestamp } = messageData;
    
    if (eventType !== 'WORKOUT_PROCESSED') {
      console.log(`Ignoring event type: ${eventType}`);
      return res.status(200).send('OK');
    }
    
    if (!workoutId || !userId) {
      console.log('Missing workoutId or userId in message');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a Cloud Task to aggregate stats in the background
    // This prevents blocking the main workflow
    const taskName = await createAggregationTask({
      userId,
      workoutId,
      timestamp: timestamp || new Date().toISOString(),
    });
    
    console.log(`Created aggregation task for user ${userId}: ${taskName}`);
    
    // Acknowledge the message
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    res.status(200).send('ERROR');
  }
});

/**
 * POST /aggregate
 * Cloud Tasks target endpoint
 * Performs the actual stats aggregation
 */
app.post('/aggregate', async (req: Request, res: Response) => {
  try {
    console.log('Received aggregation task');
    
    // Decode task payload
    const payload = req.body;
    const { userId, workoutId } = payload;
    
    if (!userId) {
      console.log('Missing userId in task payload');
      return res.status(400).json({ error: 'Missing userId' });
    }
    
    console.log(`Starting stats aggregation for user ${userId}, workout ${workoutId}`);
    
    // Perform aggregation
    const stats = await aggregateUserStats(userId);
    
    console.log(`Stats aggregation completed for user ${userId}`);
    
    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Aggregation error:', error);
    res.status(500).json({
      error: 'Aggregation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /stats/:userId
 * Get cached user stats
 */
app.get('/stats/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const stats = await getCachedUserStats(userId);
    
    if (!stats) {
      return res.status(404).json({
        error: 'Stats not found',
        message: 'No aggregated stats available for this user',
      });
    }
    
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /trigger
 * Manual trigger for stats aggregation (for testing)
 */
app.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const stats = await aggregateUserStats(userId);
    
    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error triggering aggregation:', error);
    res.status(500).json({
      error: 'Failed to trigger aggregation',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Stats-Aggregator service listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Waiting for WORKOUT_PROCESSED events and Cloud Tasks...`);
});

export default app;
