import { useState, FormEvent } from 'react';
import { getUserPersonalRecords, PersonalRecordEntry, getUserStats, UserStats, LiftRecord } from '../api/workout';
import './RecordLookup.css';

export default function RecordLookup() {
  const [userId, setUserId] = useState('demo-user-123');
  const [records, setRecords] = useState<PersonalRecordEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      // Fetch both user stats and personal records
      const [statsData, recordsData] = await Promise.all([
        getUserStats(userId),
        getUserPersonalRecords(userId)
      ]);
      setUserStats(statsData);
      setRecords(recordsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderLiftRecord = (liftName: string, record?: LiftRecord, label?: string) => {
    if (!record) return null;

    return (
      <div className="lift-record">
        <div className="lift-header">
          <span className="lift-label">{label || liftName}</span>
        </div>
        <div className="lift-details">
          <span className="lift-weight">{record.weight} kg</span>
          <span className="lift-reps">× {record.reps} reps</span>
          <span className="lift-date">{formatDate(record.date)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="record-lookup-container">
      <h2>📊 Record Lookup</h2>
      <p className="subtitle">View user statistics and lift records</p>

      <form onSubmit={handleSubmit} className="lookup-form">
        <div className="form-group">
          <label htmlFor="userId">User ID</label>
          <input
            id="userId"
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID"
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Look Up Records'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {searched && !loading && !userStats && !error && (
        <div className="no-records">
          <p>No statistics found for user: <strong>{userId}</strong></p>
          <p className="hint">Try submitting a workout first to generate statistics!</p>
        </div>
      )}

      {userStats && (
        <div className="user-stats-container">
          <h3>Stats for {userId}</h3>
          
          {/* Best DOTS Score Section */}
          <div className="stats-section">
            <h4>🏆 Best Performance</h4>
            <div className="dots-score-card">
              <div className="score-main">
                <span className="score-label">Best DOTS Score</span>
                <span className="score-value">{userStats.bestDotsScore.toFixed(2)}</span>
              </div>
              {userStats.bestDotsScoreDate && (
                <div className="score-date">
                  Achieved on {formatDate(userStats.bestDotsScoreDate)}
                </div>
              )}
            </div>
          </div>

          {/* Lift Records Section */}
          <div className="stats-section">
            <h4>💪 Lift Records</h4>
            
            {/* Squat */}
            {(userStats.liftRecords.squat?.mostRecent || userStats.liftRecords.squat?.best) && (
              <div className="lift-category">
                <h5>Squat</h5>
                <div className="lift-records-grid">
                  {renderLiftRecord('Squat', userStats.liftRecords.squat?.mostRecent, 'Most Recent')}
                  {renderLiftRecord('Squat', userStats.liftRecords.squat?.best, 'Personal Best')}
                </div>
              </div>
            )}

            {/* Bench */}
            {(userStats.liftRecords.bench?.mostRecent || userStats.liftRecords.bench?.best) && (
              <div className="lift-category">
                <h5>Bench Press</h5>
                <div className="lift-records-grid">
                  {renderLiftRecord('Bench', userStats.liftRecords.bench?.mostRecent, 'Most Recent')}
                  {renderLiftRecord('Bench', userStats.liftRecords.bench?.best, 'Personal Best')}
                </div>
              </div>
            )}

            {/* Deadlift */}
            {(userStats.liftRecords.deadlift?.mostRecent || userStats.liftRecords.deadlift?.best) && (
              <div className="lift-category">
                <h5>Deadlift</h5>
                <div className="lift-records-grid">
                  {renderLiftRecord('Deadlift', userStats.liftRecords.deadlift?.mostRecent, 'Most Recent')}
                  {renderLiftRecord('Deadlift', userStats.liftRecords.deadlift?.best, 'Personal Best')}
                </div>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="stats-section">
            <h4>📈 Summary</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Workouts</span>
                <span className="summary-value">{userStats.totalWorkouts}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Recent Workouts (30d)</span>
                <span className="summary-value">{userStats.recentWorkouts}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Volume</span>
                <span className="summary-value">{userStats.totalVolume.toLocaleString()} kg</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Avg DOTS Score</span>
                <span className="summary-value">{userStats.averageDotsScore.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {records.length > 0 && (
        <div className="records-list">
          <h3>Personal Records for {userId}</h3>
          <p className="record-count">Found {records.length} workout(s) with personal records</p>
          
          {records.map((entry) => (
            <div key={entry.id} className="record-entry">
              <div className="entry-header">
                <span className="date">
                  📅 {new Date(entry.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
                <span className="workout-id">Workout ID: {entry.workoutId}</span>
              </div>
              
              <div className="records">
                {entry.records.map((record, idx) => (
                  <div key={idx} className="record-item">
                    <div className="record-main">
                      <span className="exercise-name">💪 {record.exerciseName}</span>
                      <span className="new-best">{record.newBest} kg</span>
                    </div>
                    
                    {record.previousBest !== null && (
                      <div className="record-improvement">
                        <span className="previous">Previous: {record.previousBest} kg</span>
                        <span className="improvement">
                          +{record.improvement?.toFixed(1)} kg 
                          ({record.improvementPercentage !== null && record.improvementPercentage !== undefined
                            ? `+${((record.improvement || 0) / record.previousBest * 100).toFixed(1)}%`
                            : ''})
                        </span>
                      </div>
                    )}
                    
                    {record.previousBest === null && (
                      <div className="record-improvement first-record">
                        🎉 First record for this exercise!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
