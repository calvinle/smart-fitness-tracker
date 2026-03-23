import { z } from 'zod';

/**
 * Exercise schema validation
 * Ensures exercises have required fields and valid data types
 */
export const ExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required'),
  category: z.enum(['squat', 'bench', 'deadlift', 'accessory'], {
    errorMap: () => ({ message: 'Invalid exercise category' }),
  }),
  weight: z.number().positive('Weight must be greater than 0'),
  reps: z.number().int().positive('Reps must be a positive integer'),
  sets: z.number().int().positive('Sets must be a positive integer'),
  rpe: z.number().min(1).max(10).optional(), // Rate of Perceived Exertion
  notes: z.string().optional(),
});

/**
 * Workout session schema
 * Validates the complete workout submission
 */
export const WorkoutSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  date: z.string().datetime('Invalid date format, use ISO 8601'),
  bodyweight: z.number().positive('Bodyweight must be greater than 0'),
  exercises: z.array(ExerciseSchema).min(1, 'At least one exercise is required'),
  duration: z.number().int().positive('Duration must be a positive integer').optional(), // in minutes
  notes: z.string().optional(),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;

/**
 * Validation response interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  data?: Workout;
}

/**
 * Validates workout data against the schema
 */
export function validateWorkout(data: unknown): ValidationResult {
  try {
    const validated = WorkoutSchema.parse(data);
    
    // Additional business logic validation
    const errors: string[] = [];
    
    // Check for squat/bench/deadlift specific validations
    validated.exercises.forEach((exercise, index) => {
      if (['squat', 'bench', 'deadlift'].includes(exercise.category)) {
        if (exercise.weight <= 0) {
          errors.push(`Exercise ${index + 1} (${exercise.name}): Main lifts must have weight > 0`);
        }
        if (exercise.reps > 20) {
          errors.push(`Exercise ${index + 1} (${exercise.name}): Main lifts typically have reps ≤ 20`);
        }
      }
    });
    
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      return { valid: false, errors };
    }
    
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
