import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { validateWorkout } from './validation';
import logger from './logger';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'validator' });
});

/**
 * POST /validate
 * Validates workout data
 * 
 * Request body: Workout object
 * Response: { valid: boolean, errors?: string[], data?: Workout }
 */
app.post('/validate', (req: Request, res: Response) => {
  logger.info('Received validation request', { userId: req.body.userId, exerciseCount: req.body.exercises?.length });
  
  const result = validateWorkout(req.body);
  
  if (result.valid) {
    logger.info('Validation successful', { userId: req.body.userId });
    res.status(200).json({
      valid: true,
      data: result.data,
    });
  } else {
    logger.warn('Validation failed', { userId: req.body.userId, errors: result.errors });
    res.status(400).json({
      valid: false,
      errors: result.errors,
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
  logger.info(`Validator service started`, { 
    port: PORT, 
    environment: process.env.NODE_ENV || 'development' 
  });
});

export default app;
