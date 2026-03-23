import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { calculateScores, CalculationInput } from './calculator';

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', service: 'calculator' });
});

/**
 * POST /calculate
 * Calculates performance scores (DOTS, Wilks) and other metrics
 * 
 * Request body: CalculationInput
 * Response: CalculationResult
 */
app.post('/calculate', (req: Request, res: Response) => {
  try {
    console.log('Received calculation request:', JSON.stringify(req.body, null, 2));
    
    const input: CalculationInput = req.body;
    
    // Basic validation
    if (!input.bodyweight || input.bodyweight <= 0) {
      return res.status(400).json({
        error: 'Invalid bodyweight',
        message: 'Bodyweight must be greater than 0',
      });
    }
    
    if (!input.exercises || input.exercises.length === 0) {
      return res.status(400).json({
        error: 'Invalid exercises',
        message: 'At least one exercise is required',
      });
    }
    
    const result = calculateScores(input);
    
    console.log('Calculation successful:', result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({
      error: 'Calculation failed',
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
  console.log(`Calculator service listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
