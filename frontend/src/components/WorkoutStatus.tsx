import { useState, useEffect } from 'react';
import { getWorkoutStatus, WorkoutStatus as Status } from '../api/workout';
import './WorkoutStatus.css';

interface Props {
  executionId: string;
}

export default function WorkoutStatus({ executionId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!executionId) return;

    const fetchStatus = async () => {
      try {
        const data = await getWorkoutStatus(executionId);
        setStatus(data);
        setLoading(false);

        // Continue polling if still active
        if (data.state === 'ACTIVE' || data.state === 'STATE_ACTIVE') {
          setTimeout(fetchStatus, 2000);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch status');
        setLoading(false);
      }
    };

    fetchStatus();
  }, [executionId]);

  if (!executionId) {
    return (
      <div className="status-container">
        <p>No workout execution to track. Submit a workout first!</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="status-container">
        <div className="loading">Loading status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!status) return null;

  const isActive = status.state === 'ACTIVE' || status.state === 'STATE_ACTIVE';
  const isSuccess = status.state === 'SUCCEEDED' || status.state === 'STATE_SUCCEEDED';
  const isFailed = status.state === 'FAILED' || status.state === 'STATE_FAILED';

  return (
    <div className="status-container">
      <h2>Workout Processing Status</h2>

      <div className={`status-card ${isSuccess ? 'success' : isFailed ? 'failed' : 'active'}`}>
        <div className="status-header">
          <span className="status-label">Status:</span>
          <span className={`status-badge ${status.state.toLowerCase()}`}>
            {status.state}
          </span>
        </div>

        <div className="status-details">
          <div className="detail-row">
            <strong>Execution ID:</strong>
            <code>{executionId.split('/').pop()}</code>
          </div>
          <div className="detail-row">
            <strong>Started:</strong>
            <span>{new Date(status.startTime).toLocaleString()}</span>
          </div>
          {status.endTime && (
            <div className="detail-row">
              <strong>Completed:</strong>
              <span>{new Date(status.endTime).toLocaleString()}</span>
            </div>
          )}
        </div>

        {isActive && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Processing your workout through the microservices...</p>
            <ul className="process-steps">
              <li>✓ Validating workout data</li>
              <li>⏳ Calculating performance scores</li>
              <li>⏳ Saving to database</li>
              <li>⏳ Triggering background tasks</li>
            </ul>
          </div>
        )}

        {isSuccess && status.result && (
          <div className="result-section">
            <h3>✅ Workout Processed Successfully!</h3>
            
            {status.result.workoutId && (
              <div className="result-card">
                <h4>Workout ID</h4>
                <code>{status.result.workoutId}</code>
              </div>
            )}

            {status.result.calculation && (
              <div className="result-card">
                <h4>Performance Scores</h4>
                <div className="scores">
                  <div className="score-item">
                    <span className="score-label">DOTS Score:</span>
                    <span className="score-value">{status.result.calculation.dotsScore}</span>
                  </div>
                  <div className="score-item">
                    <span className="score-label">Wilks Score:</span>
                    <span className="score-value">{status.result.calculation.wilksScore}</span>
                  </div>
                  <div className="score-item">
                    <span className="score-label">Total Lifted:</span>
                    <span className="score-value">{status.result.calculation.totalLifted} kg</span>
                  </div>
                </div>
              </div>
            )}

            <div className="info-box">
              <p>🎯 Your workout has been saved!</p>
              <p>📊 Background services are now:</p>
              <ul>
                <li>Checking for personal records</li>
                <li>Updating your statistics dashboard</li>
              </ul>
            </div>
          </div>
        )}

        {isFailed && (
          <div className="error-section">
            <h3>❌ Processing Failed</h3>
            <p>{status.error || 'An error occurred during processing'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
