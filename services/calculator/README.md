# Calculator Service

Microservice responsible for calculating performance scores and workout metrics.

## Responsibilities

- Calculate DOTS score (powerlifting performance metric)
- Calculate Wilks score (alternative performance metric)
- Estimate one-rep max (1RM) for exercises
- Calculate volume by exercise category
- Compute total lifted weight

## API Endpoints

### POST /calculate

Calculates performance scores and metrics.

**Request Body:**
```json
{
  "bodyweight": 80.5,
  "gender": "male",
  "exercises": [
    {
      "name": "Squat",
      "category": "squat",
      "weight": 100,
      "reps": 5,
      "sets": 3
    }
  ]
}
```

**Response (200):**
```json
{
  "totalLifted": 316.67,
  "dotsScore": 245.32,
  "wilksScore": 278.45,
  "estimatedOneRepMax": {
    "Squat": 316.67
  },
  "volumeByCategory": {
    "squat": 1500
  }
}
```

### GET /health

Health check endpoint.

## Formulas

### DOTS Score
DOTS (Dots Performance Points) normalizes strength across different bodyweights.

### Wilks Score
Wilks coefficient is a classic powerlifting formula for comparing lifters.

### One-Rep Max (Epley Formula)
1RM = weight × (1 + reps / 30)

## Environment Variables

- `PORT` - Server port (default: 8081)
- `NODE_ENV` - Environment (development/production)

## Local Development

```bash
npm install
npm run dev
```

## Cloud Run Deployment

```bash
gcloud run deploy calculator \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 256Mi
```
