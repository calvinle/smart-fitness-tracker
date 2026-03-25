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

export interface PersonalRecord {
  exerciseName: string;
  previousBest: number | null;
  newBest: number;
  improvement?: number | null;
  improvementPercentage?: number | null;
  isPR?: boolean;
  date?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  workoutId: string;
  read: boolean;
  createdAt: string;
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
  // URL encode the execution ID since it contains slashes
  const encodedId = encodeURIComponent(executionId);
  const response = await api.get<{ success: boolean; data: WorkoutStatus }>(
    `/api/workout/${encodedId}/status`
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

export const getWorkoutNotifications = async (workoutId: string): Promise<Notification[]> => {
  const response = await api.get<{ success: boolean; data: Notification[] }>(
    `/api/workout/${workoutId}/notifications`
  );
  return response.data.data || [];
};

export interface PersonalRecordEntry {
  id: string;
  workoutId: string;
  userId: string;
  date: string;
  records: PersonalRecord[];
  createdAt: string;
}

export interface LiftRecord {
  weight: number;
  reps: number;
  date: string;
  workoutId: string;
}

export interface UserStats {
  userId: string;
  totalWorkouts: number;
  totalVolume: number;
  totalLifted: number;
  averageDotsScore: number;
  bestDotsScore: number;
  bestDotsScoreDate?: string;
  volumeByCategory: { [category: string]: number };
  exerciseFrequency: { [exerciseName: string]: number };
  recentWorkouts: number;
  consistency: number;
  liftRecords: {
    squat?: {
      mostRecent?: LiftRecord;
      best?: LiftRecord;
    };
    bench?: {
      mostRecent?: LiftRecord;
      best?: LiftRecord;
    };
    deadlift?: {
      mostRecent?: LiftRecord;
      best?: LiftRecord;
    };
  };
  lastUpdated: any;
}

export const getUserPersonalRecords = async (userId: string): Promise<PersonalRecordEntry[]> => {
  const response = await api.get<{ success: boolean; data: PersonalRecordEntry[] }>(
    `/api/users/${userId}/personal-records`
  );
  return response.data.data || [];
};

export const getUserStats = async (userId: string): Promise<UserStats | null> => {
  try {
    const response = await api.get<{ success: boolean; data: UserStats }>(
      `/api/users/${userId}/stats`
    );
    return response.data.data || null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};
