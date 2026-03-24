import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import WorkoutForm from './components/WorkoutForm';
import RecordLookup from './components/RecordLookup';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>💪 Smart Fitness Tracker</h1>
          <p>Microservices-based workout tracking with GCP orchestration</p>
          <nav>
            <Link to="/">Submit Workout</Link>
            <Link to="/records">Record Lookup</Link>
          </nav>
        </header>

        <main className="App-main">
          <Routes>
            <Route 
              path="/" 
              element={<WorkoutForm />} 
            />
            <Route 
              path="/records" 
              element={<RecordLookup />} 
            />
          </Routes>
        </main>

        <footer className="App-footer">
          <p>
            Demonstrating: GCP Workflows (Orchestration) | Pub/Sub (Choreography) | 
            Cloud Run | Cloud Tasks | Firestore
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
