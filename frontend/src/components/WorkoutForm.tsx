import { useState, FormEvent } from 'react';
import { submitWorkout, Exercise, WorkoutSubmission } from '../api/workout';
import WorkoutStatus from './WorkoutStatus';
import './WorkoutForm.css';

interface Props {
  onSubmitted: (executionId: string) => void;
}

export default function WorkoutForm({ onSubmitted }: Props) {
  const [userId, setUserId] = useState('demo-user-123');
  const [bodyweight, setBodyweight] = useState(80);
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: 'Squat', category: 'squat', weight: 100, reps: 5, sets: 3, rpe: 8 },
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [executionId, setExecutionId] = useState<string>('');

  const addExercise = () => {
    setExercises([
      ...exercises,
      { name: '', category: 'accessory', weight: 0, reps: 0, sets: 0 },
    ]);
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const workout: WorkoutSubmission = {
        userId,
        date: new Date().toISOString(),
        bodyweight,
        exercises: exercises.filter(ex => ex.name && ex.weight > 0),
        notes,
      };

      const response = await submitWorkout(workout);

      if (response.success && response.data?.executionId) {
        setSuccess('Workout submitted successfully! Processing...');
        setExecutionId(response.data.executionId);
        onSubmitted(response.data.executionId);
      } else {
        setError(response.error || 'Failed to submit workout');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workout-form-container">
      <h2>Log Workout</h2>

      <form onSubmit={handleSubmit} className="workout-form">
        <div className="form-group">
          <label>User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Bodyweight (kg)</label>
          <input
            type="number"
            step="0.1"
            value={bodyweight}
            onChange={(e) => setBodyweight(parseFloat(e.target.value))}
            required
          />
        </div>

        <div className="exercises-section">
          <div className="section-header">
            <h3>Exercises</h3>
            <button type="button" onClick={addExercise} className="add-btn">
              + Add Exercise
            </button>
          </div>

          {exercises.map((exercise, index) => (
            <div key={index} className="exercise-card">
              <div className="exercise-header">
                <span>Exercise {index + 1}</span>
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="exercise-fields">
                <div className="field-group">
                  <label>Exercise Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Squat, Bench Press"
                    value={exercise.name}
                    onChange={(e) => updateExercise(index, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Category</label>
                  <select
                    value={exercise.category}
                    onChange={(e) => updateExercise(index, 'category', e.target.value)}
                  >
                    <option value="squat">Squat</option>
                    <option value="bench">Bench Press</option>
                    <option value="deadlift">Deadlift</option>
                    <option value="accessory">Accessory</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>Weight (kg)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={exercise.weight || ''}
                    onChange={(e) => updateExercise(index, 'weight', parseFloat(e.target.value))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Reps</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={exercise.reps || ''}
                    onChange={(e) => updateExercise(index, 'reps', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>Sets</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={exercise.sets || ''}
                    onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="field-group">
                  <label>RPE (1-10)</label>
                  <input
                    type="number"
                    placeholder="Optional"
                    min="1"
                    max="10"
                    value={exercise.rpe || ''}
                    onChange={(e) => updateExercise(index, 'rpe', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="How did the workout feel?"
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Submitting...' : 'Save Workout'}
        </button>
      </form>

      {/* Display workout status and PR notifications below the form */}
      {executionId && (
        <div className="status-section">
          <WorkoutStatus executionId={executionId} />
        </div>
      )}
    </div>
  );
}
