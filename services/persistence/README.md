# Persistence Service

Microservice responsible for persisting workout data to Firestore and triggering Pub/Sub events.

## Responsibilities

- Save validated and calculated workout data to Firestore
- Publish `WORKOUT_PROCESSED` event to Pub/Sub (triggers choreographed services)
- Provide workout retrieval endpoints
- Query personal records

## API Endpoints

### POST /persist

Saves workout to Firestore and publishes event.

**Request Body:**
```json
{
  "validatedData": { ...workout data },
  "calculatedScores": { ...scores }
}
```

**Response (201):**
```json
{
  "success": true,
  "workoutId": "abc123",
  "workout": { ...saved workout }
}
```

### GET /workouts/:userId

Get user's workout history.

**Query Parameters:**
- `limit` - Max number of workouts (default: 50)

### GET /workout/:workoutId

Get specific workout by ID.

### GET /records/:userId

Get user's personal records for all exercises.

### GET /health

Health check endpoint.

## Pub/Sub Event

After successful persistence, publishes to `workout-processed` topic:

```json
{
  "workoutId": "abc123",
  "userId": "user123",
  "timestamp": "2026-03-23T10:30:00Z",
  "eventType": "WORKOUT_PROCESSED"
}
```

## Environment Variables

- `PORT` - Server port (default: 8082)
- `GCP_PROJECT_ID` - GCP Project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key (local dev only)
- `NODE_ENV` - Environment (development/production)

## Firestore Schema

**Collection:** `workouts`

**Document Structure:**
```typescript
{
  userId: string;
  date: string;
  bodyweight: number;
  exercises: Exercise[];
  totalLifted: number;
  dotsScore: number;
  wilksScore: number;
  estimatedOneRepMax: { [name: string]: number };
  volumeByCategory: { [category: string]: number };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## Local Development

```bash
export GCP_PROJECT_ID=your-project-id
export GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json
npm install
npm run dev
```

## Cloud Run Deployment

```bash
gcloud run deploy persistence \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 256Mi \
  --set-env-vars GCP_PROJECT_ID=your-project-id
```
