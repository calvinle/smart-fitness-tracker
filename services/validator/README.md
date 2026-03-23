# Validator Service

Microservice responsible for validating workout data schema and business rules.

## Responsibilities

- Validate workout JSON structure using Zod schemas
- Ensure required fields are present
- Validate data types and ranges
- Apply business logic rules (e.g., weight > 0 for main lifts)

## API Endpoints

### POST /validate

Validates workout data.

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

**Success Response (200):**
```json
{
  "valid": true,
  "data": { ...validated workout data }
}
```

**Error Response (400):**
```json
{
  "valid": false,
  "errors": [
    "exercises.0.weight: Weight must be greater than 0"
  ]
}
```

### GET /health

Health check endpoint.

## Environment Variables

- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (development/production)

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Docker

```bash
docker build -t validator .
docker run -p 8080:8080 validator
```

## Cloud Run Deployment

```bash
gcloud run deploy validator \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 256Mi
```
