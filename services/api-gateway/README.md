# API Gateway

Lightweight Golang API Gateway that serves as the entry point for workout submissions.

## Responsibilities

- Receive workout submissions from the frontend
- Validate basic request structure
- Trigger GCP Workflows for orchestrated processing
- Provide workflow execution status endpoints
- Handle CORS for frontend integration

## Why Golang?

- **Performance**: Fast request handling with low memory footprint
- **Concurrency**: Excellent for handling multiple simultaneous requests
- **Small container size**: Minimal resource usage (stays within free tier)
- **Type safety**: Compile-time error checking

## API Endpoints

### POST /api/workout

Submit a new workout for processing.

**Request Body:**
```json
{
  "userId": "user123",
  "date": "2026-03-23T10:30:00Z",
  "bodyweight": 80.5,
  "exercises": [
    {
      "name": "Squat",
      "category": "squat",
      "weight": 100,
      "reps": 5,
      "sets": 3,
      "rpe": 8
    }
  ],
  "duration": 60,
  "notes": "Good session"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Workout submission accepted and processing started",
  "requestId": "projects/.../workflows/.../executions/...",
  "data": {
    "executionId": "...",
    "statusUrl": "/api/workout/{executionId}/status"
  }
}
```

### GET /api/workout/:executionId/status

Get the status of a workflow execution.

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "...",
    "state": "SUCCEEDED",
    "startTime": "2026-03-23T10:30:00Z",
    "endTime": "2026-03-23T10:30:05Z",
    "result": { ... }
  }
}
```

**Workflow States:**
- `ACTIVE`: Currently processing
- `SUCCEEDED`: Completed successfully
- `FAILED`: Processing failed
- `CANCELLED`: Execution was cancelled

### GET /health

Health check endpoint.

## Environment Variables

- `PORT` - Server port (default: 8080)
- `GCP_PROJECT_ID` - GCP Project ID (required)
- `GCP_REGION` - GCP region (default: us-central1)
- `WORKFLOW_ID` - Workflow name (default: workout-processing-workflow)
- `LOG_LEVEL` - Set to "debug" for verbose logging (default: info)

## Logging

The API Gateway uses **zerolog** for structured logging, which integrates seamlessly with GCP Cloud Logging.

**Features:**
- **JSON output in production** (Cloud Run) for GCP Cloud Logging
- **Pretty console output in development** for easy debugging
- **Structured logs** with contextual metadata (userId, executionId, etc.)
- **Request logging middleware** that logs all HTTP requests with duration and status

**Log Levels:**
- `Info` - General operational events
- `Debug` - Detailed debugging information (set `LOG_LEVEL=debug`)
- `Warn` - Warning conditions
- `Error` - Error events that might still allow the app to continue
- `Fatal` - Severe errors that cause the application to abort

**Example log output (development):**
```
2026-03-24T10:30:45Z INF API Gateway starting port=8085 service=api-gateway
2026-03-24T10:30:50Z INF HTTP request method=POST path=/api/workout remote_addr=127.0.0.1:54321 status=202 duration_ms=153
2026-03-24T10:30:50Z INF Workflow triggered successfully executionId=mock-execution-1711276250 userId=user-123
```

**Example log output (production JSON):**
```json
{"level":"info","time":1711276245,"message":"API Gateway starting","port":"8085","service":"api-gateway"}
{"level":"info","time":1711276250,"message":"HTTP request","method":"POST","path":"/api/workout","remote_addr":"10.0.1.5:54321","status":202,"duration_ms":153}
{"level":"info","time":1711276250,"message":"Workflow triggered successfully","executionId":"projects/.../executions/abc123","userId":"user-123"}
```

## Local Development

**Install dependencies:**
```bash
go mod download
# or
go mod tidy
```

**Run the service:**
```bash
export GCP_PROJECT_ID=your-project-id
export WORKFLOW_ID=workout-processing-workflow
go run main.go
```

## Build

```bash
go build -o api-gateway
```

## Docker

```bash
docker build -t api-gateway .
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=your-project-id \
  -e WORKFLOW_ID=workout-processing-workflow \
  api-gateway
```

## Cloud Run Deployment

**Important**: Before deploying, ensure Firestore indexes are created.

**Option 1 - Using Firebase CLI (Recommended):**
```bash
# From the project root directory
firebase deploy --only firestore:indexes --project YOUR_PROJECT_ID
```

**Option 2 - Using gcloud (create each index individually):**
```bash
# Create index for personal-records collection
gcloud firestore indexes composite create \
  --collection-group=personal-records \
  --database=workouts \
  --query-scope=COLLECTION \
  --field-config field-path=userId,order=ascending \
  --field-config field-path=date,order=descending \
  --project=YOUR_PROJECT_ID

# Create index for workouts collection  
gcloud firestore indexes composite create \
  --collection-group=workouts \
  --database=workouts \
  --query-scope=COLLECTION \
  --field-config field-path=userId,order=ascending \
  --field-config field-path=date,order=descending \
  --project=YOUR_PROJECT_ID

# Create index for notifications collection
gcloud firestore indexes composite create \
  --collection-group=notifications \
  --database=workouts \
  --query-scope=COLLECTION \
  --field-config field-path=workoutId,order=ascending \
  --field-config field-path=type,order=ascending \
  --field-config field-path=createdAt,order=descending \
  --project=YOUR_PROJECT_ID
```

Then deploy the API Gateway:

```bash
gcloud run deploy api-gateway \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 128Mi \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,WORKFLOW_ID=workout-processing-workflow
```

## CORS Configuration

The gateway is configured to allow all origins by default for development. In production, update the CORS configuration in `main.go` to restrict to your frontend domain:

```go
AllowedOrigins: []string{"https://your-app.web.app"},
```

## Performance

- **Memory**: ~50MB runtime
- **Cold start**: <1 second
- **Response time**: <100ms (excluding workflow execution)

Ideal for GCP Free Tier with:
- 2M requests/month free
- 360K GB-seconds/month free
- Always-free Cloud Run allowance

## TODO
- Authentication upon real-world usage