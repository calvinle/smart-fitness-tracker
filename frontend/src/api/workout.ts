import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8080';

export interface Exercise {
  name: string;
  category: 'squat' | 'bench' | 'deadlift' | 'accessory';
  weight: number;
  reps: number;
  sets: number;
  rpe?: number;
  notes?: string;
}

export interface WorkoutSubmission {
  userId: string;
  date: string;
  bodyweight: number;
  exercises: Exercise[];
  duration?: number;
  notes?: string;
}

export interface WorkoutResponse {
  success: boolean;
  message: string;
  requestId?: string;
  data?: {
    executionId: string;
    statusUrl: string;
  };
  error?: string;
}

export interface WorkoutStatus {
  executionId: string;
  state: string;
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const submitWorkout = async (workout: WorkoutSubmission): Promise<WorkoutResponse> => {
  const response = await api.post<WorkoutResponse>('/api/workout', workout);
  return response.data;
};

export const getWorkoutStatus = async (executionId: string): Promise<WorkoutStatus> => {
  const response = await api.get<{ success: boolean; data: WorkoutStatus }>(
    `/api/workout/${executionId}/status`
  );
  return response.data.data;
};

export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.data.success === true;
  } catch {
    return false;
  }
};
