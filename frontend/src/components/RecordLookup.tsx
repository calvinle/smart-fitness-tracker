import { useState, FormEvent } from 'react';
import { getUserPersonalRecords, PersonalRecordEntry } from '../api/workout';
import './RecordLookup.css';

export default function RecordLookup() {
  const [userId, setUserId] = useState('demo-user-123');
  const [records, setRecords] = useState<PersonalRecordEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const data = await getUserPersonalRecords(userId);
      setRecords(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch personal records');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="record-lookup-container">
      <h2>📊 Record Lookup</h2>
      <p className="subtitle">View all personal records for a user</p>

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

      {searched && !loading && records.length === 0 && !error && (
        <div className="no-records">
          <p>No personal records found for user: <strong>{userId}</strong></p>
          <p className="hint">Try submitting a workout first to generate personal records!</p>
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
