# PR-Detector Service

Microservice that detects personal records (PRs) by comparing new workouts to historical data. Part of the choreographed workflow.

## Responsibilities

- Listen to `WORKOUT_PROCESSED` Pub/Sub events
- Compare new workout to user's historical data
- Detect personal bests for each exercise
- Send notifications when PRs are detected
- Log PRs to Firestore

## Trigger

This service is triggered by Pub/Sub when the Persistence service publishes a `WORKOUT_PROCESSED` event.

## API Endpoints

### POST /pubsub

Pub/Sub push endpoint that receives workout processed events.

**Pub/Sub Message Format:**
```json
{
  "workoutId": "abc123",
  "userId": "user123",
  "timestamp": "2026-03-23T10:30:00Z",
  "eventType": "WORKOUT_PROCESSED"
}
```

### POST /detect

Manual PR detection endpoint (for testing).

**Request Body:**
```json
{
  "workoutId": "abc123",
  "userId": "user123"
}
```

**Response:**
```json
{
  "workoutId": "abc123",
  "userId": "user123",
  "hasPersonalRecords": true,
  "personalRecords": [
    {
      "exerciseName": "Squat",
      "previousBest": 95,
      "newBest": 100,
      "improvement": 5,
      "improvementPercentage": 5.3,
      "isPR": true
    }
  ],
  "notificationSent": true
}
```

### GET /health

Health check endpoint.

## Firestore Collections

### `personal-records`
Stores detected personal records:
```typescript
{
  workoutId: string;
  userId: string;
  date: string;
  records: PersonalRecord[];
  createdAt: Timestamp;
}
```

### `notifications`
Stores notification logs:
```typescript
{
  userId: string;
  type: 'PERSONAL_RECORD';
  title: string;
  message: string;
  workoutId: string;
  read: boolean;
  createdAt: Timestamp;
}
```

## Environment Variables

- `PORT` - Server port (default: 8083)
- `GCP_PROJECT_ID` - GCP Project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Service account key (local dev)
- `NODE_ENV` - Environment

## Local Development

```bash
export GCP_PROJECT_ID=your-project-id
npm install
npm run dev
```

## Cloud Run Deployment with Pub/Sub

```bash
# Deploy service
gcloud run deploy pr-detector \
  --source . \
  --region us-central1 \
  --no-allow-unauthenticated \
  --max-instances 10 \
  --memory 256Mi \
  --set-env-vars GCP_PROJECT_ID=your-project-id

# Create Pub/Sub subscription with push to Cloud Run
gcloud pubsub subscriptions create pr-detector-sub \
  --topic=workout-processed \
  --push-endpoint=https://pr-detector-xxx.run.app/pubsub \
  --push-auth-service-account=SERVICE_ACCOUNT_EMAIL
```
