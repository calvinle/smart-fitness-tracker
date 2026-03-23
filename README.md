# Smart Fitness Tracker

A microservices-based fitness tracking application demonstrating GCP orchestrated and choreographed workflows.

## Architecture Overview

### Components
1. **API Gateway** (Golang) - Entry point for workout submissions
2. **Validator Service** (Node.js/TypeScript) - Validates workout data schema
3. **Calculator Service** (Node.js/TypeScript) - Computes DOTS/Wilks scores
4. **Persistence Service** (Node.js/TypeScript) - Saves data to Firestore
5. **PR-Detector Service** (Node.js/TypeScript) - Detects personal records
6. **Stats-Aggregator Service** (Node.js/TypeScript) - Background stats processing via Cloud Tasks
7. **Frontend** (React) - User interface hosted on Firebase Hosting

### Workflow Types

#### Phase A: Orchestrated (GCP Workflows)
Sequential execution managed by GCP Workflows:
1. Validator validates workout schema
2. Calculator computes performance scores
3. Persistence saves to Firestore

If any step fails, the sequence stops.

#### Phase B: Choreographed (Pub/Sub)
After successful orchestration, a Pub/Sub event triggers independent services:
1. PR-Detector checks for personal bests
2. Stats-Aggregator queues background aggregation via Cloud Tasks

## Project Structure

```
smart-fitness-tracker/
├── services/
│   ├── api-gateway/          # Golang API Gateway
│   ├── validator/            # Workout validation service
│   ├── calculator/           # Score calculation service
│   ├── persistence/          # Firestore persistence service
│   ├── pr-detector/          # Personal record detection
│   └── stats-aggregator/     # Background stats processing
├── workflows/                # GCP Workflows definitions
├── frontend/                 # React SPA
└── infrastructure/           # Deployment scripts
```

## GCP Services Used

- **Cloud Run**: Containerized microservices
- **GCP Workflows**: Orchestrated sequential logic
- **Pub/Sub**: Event-driven choreography
- **Cloud Tasks**: Asynchronous background processing
- **Firestore**: NoSQL database
- **Firebase Hosting**: Frontend hosting
- **Container Registry**: Docker image storage


## Getting Started

### Prerequisites
- Node.js 18+
- Go 1.21+
- Docker
- GCP Project with billing enabled
- gcloud CLI configured

### Local Development
See individual service READMEs for local development instructions.

### Deployment
See `infrastructure/README.md` for deployment instructions.

## API Flow

```
User Submits Workout
    ↓
API Gateway (Cloud Run)
    ↓
GCP Workflow Triggers
    ↓
[Orchestrated Phase A]
    ↓
Validator → Calculator → Persistence
    ↓
[Choreographed Phase B]
    ↓
Pub/Sub Topic: WORKOUT_PROCESSED
    ↙          ↘
PR-Detector   Stats-Aggregator
              (via Cloud Tasks)
```

## Environment Variables

Each service requires specific environment variables. See individual service documentation for details.

## License

MIT
