import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { saveWorkout, getUserWorkouts, getWorkout, getPersonalRecords } from './firestore';
import { publishWorkoutProcessed } from './pubsub';
import logger from './logger';

const app = express();
const PORT = process.env.PORT || 8082;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'persistence' });
});

/**
 * POST /persist
 * Saves workout to Firestore and publishes Pub/Sub event
 * 
 * Request body: { validatedData, calculatedScores }
 * Response: { success: true, workoutId: string, workout: WorkoutDocument }
 */
app.post('/persist', async (req: Request, res: Response) => {
  try {
    logger.info('Received persistence request', { userId: req.body.validatedData?.userId });
    
    const { validatedData, calculatedScores } = req.body;
    
    if (!validatedData || !calculatedScores) {
      return res.status(400).json({
        error: 'Missing required data',
        message: 'Both validatedData and calculatedScores are required',
      });
    }
    
    // Save to Firestore
    const { id, workout } = await saveWorkout(validatedData, calculatedScores);
    
    logger.info('Workout persisted successfully', { workoutId: id, userId: validatedData.userId });
    
    // Publish event to Pub/Sub to trigger choreographed services
    await publishWorkoutProcessed(id, validatedData.userId);
    
    res.status(201).json({
      success: true,
      workoutId: id,
      workout,
    });
  } catch (error) {
    logger.error('Persistence error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      error: 'Failed to persist workout',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /workouts/:userId
 * Get user's workout history
 */
app.get('/workouts/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const workouts = await getUserWorkouts(userId, limit);
    
    res.status(200).json({
      userId,
      count: workouts.length,
      workouts,
    });
  } catch (error) {
    logger.error('Error fetching workouts', { 
      userId: req.params.userId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      error: 'Failed to fetch workouts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /workout/:workoutId
 * Get specific workout
 */
app.get('/workout/:workoutId', async (req: Request, res: Response) => {
  try {
    const { workoutId } = req.params;
    
    const workout = await getWorkout(workoutId);
    
    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    
    res.status(200).json(workout);
  } catch (error) {
    logger.error('Error fetching workout', { 
      workoutId: req.params.workoutId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      error: 'Failed to fetch workout',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /records/:userId
 * Get user's personal records
 */
app.get('/records/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const records = await getPersonalRecords(userId);
    
    res.status(200).json({
      userId,
      personalRecords: records,
    });
  } catch (error) {
    logger.error('Error fetching personal records', { 
      userId: req.params.userId,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({
      error: 'Failed to fetch personal records',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  logger.error('Error occurred', { error: err.message, stack: err.stack, path: req.path });
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
  logger.info('Persistence service started', { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development',
    gcpProject: process.env.GCP_PROJECT_ID || 'not set'
  });
});

export default app;
