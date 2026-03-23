# Stats-Aggregator Service

Microservice that performs background statistics aggregation using Cloud Tasks. Part of the choreographed workflow.

## Responsibilities

- Listen to `WORKOUT_PROCESSED` Pub/Sub events
- Create Cloud Tasks for asynchronous stats processing
- Aggregate user statistics (total volume, DOTS scores, exercise frequency, etc.)
- Cache aggregated stats in Firestore for fast retrieval

## Why Cloud Tasks?

Stats aggregation can be computationally expensive (scanning 100s-1000s of workouts). Cloud Tasks allows:
- **Asynchronous processing**: Main workflow doesn't wait
- **Rate limiting**: Prevents overwhelming the database
- **Retry logic**: Automatic retries on failure
- **Deduplication**: Prevents duplicate aggregations

## Workflow

1. Pub/Sub message received (`WORKOUT_PROCESSED`)
2. Create Cloud Task with user/workout info
3. Task executes `/aggregate` endpoint asynchronously
4. Aggregation scans all user workouts
5. Results cached in `user-stats` collection

## API Endpoints

### POST /pubsub

Pub/Sub push endpoint that creates Cloud Tasks.

### POST /aggregate

Cloud Tasks target endpoint that performs aggregation.

**Task Payload:**
```json
{
  "userId": "user123",
  "workoutId": "abc123",
  "timestamp": "2026-03-23T10:30:00Z"
}
```

### GET /stats/:userId

Get cached user statistics.

**Response:**
```json
{
  "userId": "user123",
  "totalWorkouts": 150,
  "totalVolume": 125000,
  "totalLifted": 45000,
  "averageDotsScore": 285.5,
  "bestDotsScore": 320.8,
  "volumeByCategory": {
    "squat": 45000,
    "bench": 35000,
    "deadlift": 45000
  },
  "exerciseFrequency": {
    "Squat": 150,
    "Bench Press": 150
  },
  "recentWorkouts": 12,
  "consistency": 3.5,
  "lastUpdated": "..."
}
```

### POST /trigger

Manual trigger for stats aggregation (testing).

### GET /health

Health check endpoint.

## Environment Variables

- `PORT` - Server port (default: 8084)
- `GCP_PROJECT_ID` - GCP Project ID
- `GCP_REGION` - GCP region (default: us-central1)
- `CLOUD_TASKS_QUEUE` - Cloud Tasks queue name
- `SERVICE_URL` - This service's URL for Cloud Tasks
- `SERVICE_ACCOUNT_EMAIL` - Service account for OIDC token
- `NODE_ENV` - Environment

## Firestore Collections

### `user-stats`
Stores aggregated statistics:
```typescript
{
  userId: string;
  totalWorkouts: number;
  totalVolume: number;
  totalLifted: number;
  averageDotsScore: number;
  bestDotsScore: number;
  volumeByCategory: { [category: string]: number };
  exerciseFrequency: { [name: string]: number };
  recentWorkouts: number;
  consistency: number;
  lastUpdated: Timestamp;
}
```

## Local Development

```bash
export GCP_PROJECT_ID=your-project-id
export SERVICE_URL=http://localhost:8084
npm install
npm run dev
```

## Cloud Run Deployment

### 1. Create Cloud Tasks Queue

```bash
gcloud tasks queues create stats-aggregation-queue \
  --location=us-central1
```

### 2. Deploy Service

```bash
gcloud run deploy stats-aggregator \
  --source . \
  --region us-central1 \
  --no-allow-unauthenticated \
  --max-instances 5 \
  --memory 512Mi \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_REGION=us-central1,CLOUD_TASKS_QUEUE=stats-aggregation-queue,SERVICE_URL=https://stats-aggregator-xxx.run.app
```

### 3. Create Pub/Sub Subscription

```bash
gcloud pubsub subscriptions create stats-aggregator-sub \
  --topic=workout-processed \
  --push-endpoint=https://stats-aggregator-xxx.run.app/pubsub \
  --push-auth-service-account=SERVICE_ACCOUNT_EMAIL
```

## Testing Cloud Tasks

```bash
# Manually trigger aggregation
curl -X POST https://stats-aggregator-xxx.run.app/trigger \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```
