import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PubSub, Message } from '@google-cloud/pubsub';
import { detectPersonalRecords, sendPRNotification } from './detector';

const app = express();
const PORT = process.env.PORT || 8083;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : [];

// Middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '100kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'pr-detector' });
});

/**
 * POST /detect
 * Manual PR detection endpoint (for testing)
 */
app.post('/detect', limiter, async (req: Request, res: Response) => {
  try {
    const { workoutId, userId } = req.body;
    
    if (!workoutId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'workoutId and userId are required',
      });
    }
    
    const result = await detectPersonalRecords(workoutId, userId);
    
    if (result.hasPersonalRecords) {
      await sendPRNotification(result);
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('PR detection error:', error);
    res.status(500).json({
      error: 'PR detection failed',
      message: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : 'An internal error occurred',
    });
  }
});

/**
 * POST /pubsub
 * Pub/Sub push endpoint
 * Receives WORKOUT_PROCESSED events
 */
app.post('/pubsub', limiter, async (req: Request, res: Response) => {
  try {
    console.log('Received Pub/Sub message');
    
    // Decode the Pub/Sub message
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
    
    const { workoutId, userId, eventType } = messageData;
    
    if (eventType !== 'WORKOUT_PROCESSED') {
      console.log(`Ignoring event type: ${eventType}`);
      return res.status(200).send('OK');
    }
    
    if (!workoutId || !userId) {
      console.log('Missing workoutId or userId in message');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Detect personal records
    const result = await detectPersonalRecords(workoutId, userId);
    
    // Send notification if PRs detected
    if (result.hasPersonalRecords) {
      await sendPRNotification(result);
    } else {
      console.log('No personal records detected');
    }
    
    // Acknowledge the message
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Pub/Sub message:', error);
    // Return 200 to acknowledge message even on error (prevent infinite retries)
    // In production, might want to send to dead letter queue instead
    res.status(200).send('ERROR');
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
  console.log(`PR-Detector service listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Waiting for WORKOUT_PROCESSED events...`);
});

export default app;
