import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateWorkout } from './validation';

const app = express();
const PORT = process.env.PORT || 8080;

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
  res.status(200).json({ status: 'healthy', service: 'validator' });
});

/**
 * POST /validate
 * Validates workout data
 * 
 * Request body: Workout object
 * Response: { valid: boolean, errors?: string[], data?: Workout }
 */
app.post('/validate', limiter, (req: Request, res: Response) => {
  console.log('Received validation request:', JSON.stringify(req.body, null, 2));
  
  const result = validateWorkout(req.body);
  
  if (result.valid) {
    console.log('Validation successful');
    res.status(200).json({
      valid: true,
      data: result.data,
    });
  } else {
    console.log('Validation failed:', result.errors);
    res.status(400).json({
      valid: false,
      errors: result.errors,
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
  console.log(`Validator service listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
