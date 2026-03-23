# Local Development & Testing Guide

This guide will help you run and test all microservices locally before deploying to GCP.

## Prerequisites

Ensure you have installed:
- ✅ Node.js 18+ (`node --version`)
- ✅ Go 1.21+ (`go version`)
- ✅ Docker (optional, for Firestore emulator)

## Quick Start (5 minutes)

### Step 1: Install All Dependencies

```bash
# From project root
cd /home/calvinle/smart-fitness-tracker

# Install root dependencies
npm install

# Install all service dependencies
npm run install:all
```

### Step 2: Set Up Environment Variables

```bash
# Create a .env file for local development
cat > .env.local << 'EOF'
# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1

# Service Ports
VALIDATOR_PORT=8080
CALCULATOR_PORT=8081
PERSISTENCE_PORT=8082
PR_DETECTOR_PORT=8083
STATS_AGGREGATOR_PORT=8084
API_GATEWAY_PORT=8085

# Local Service URLs (for workflow testing)
VALIDATOR_URL=http://localhost:8080
CALCULATOR_URL=http://localhost:8081
PERSISTENCE_URL=http://localhost:8082

# Node Environment
NODE_ENV=development
EOF

# Load environment variables
export $(cat .env.local | xargs)
```

### Step 3: Choose Your Testing Approach

**Option A: Mock Mode (No GCP Required)** - Best for testing logic
**Option B: Real GCP Services** - Best for end-to-end testing

## Option A: Mock Mode Testing (Recommended for First Run)

This runs services without needing real Firestore/Pub/Sub.

### 1. Run Services with Mock Data

Open **6 terminal tabs** and run each service:

#### Terminal 1: Validator
```bash
cd services/validator
PORT=8080 npm run dev
```

#### Terminal 2: Calculator
```bash
cd services/calculator
PORT=8081 npm run dev
```

#### Terminal 3: Persistence (Mock Mode)
```bash
cd services/persistence
PORT=8082 MOCK_MODE=true npm run dev
```

#### Terminal 4: PR-Detector (Mock Mode)
```bash
cd services/pr-detector
PORT=8083 MOCK_MODE=true npm run dev
```

#### Terminal 5: Stats-Aggregator (Mock Mode)
```bash
cd services/stats-aggregator
PORT=8084 MOCK_MODE=true npm run dev
```

#### Terminal 6: API Gateway
```bash
cd services/api-gateway
PORT=8085 \
  WORKFLOW_MOCK=true \
  VALIDATOR_SERVICE_URL=http://localhost:8080 \
  CALCULATOR_SERVICE_URL=http://localhost:8081 \
  PERSISTENCE_SERVICE_URL=http://localhost:8082 \
  go run main.go
```

### 2. Test Individual Services

#### Test Validator
```bash
curl -X POST http://localhost:8080/validate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "date": "2026-03-23T10:30:00Z",
    "bodyweight": 80.5,
    "exercises": [
      {
        "name": "Squat",
        "category": "squat",
        "weight": 100,
        "reps": 5,
        "sets": 3
      }
    ]
  }'
```

**Expected Output:**
```json
{
  "valid": true,
  "data": { ... }
}
```

#### Test Calculator
```bash
curl -X POST http://localhost:8081/calculate \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Expected Output:**
```json
{
  "totalLifted": 316.67,
  "dotsScore": 245.32,
  "wilksScore": 278.45,
  ...
}
```

#### Test Persistence (Mock)
```bash
curl -X POST http://localhost:8082/persist \
  -H "Content-Type: application/json" \
  -d '{
    "validatedData": {
      "userId": "test-user",
      "bodyweight": 80.5,
      "exercises": []
    },
    "calculatedScores": {
      "dotsScore": 245.32
    }
  }'
```

### 3. Run Frontend
```bash
cd frontend
npm run dev
```

Visit: http://localhost:3000

---

## Option B: Real GCP Services (Full Integration)

This connects to actual Firestore and Pub/Sub for complete testing.

### Prerequisites

1. **GCP Project Initialized** ✅ (you mentioned you have this)
2. **Enable Required APIs**
3. **Create Service Account**
4. **Initialize Firestore**

### Step 1: Enable GCP APIs

```bash
# Set your project
export GCP_PROJECT_ID=your-actual-project-id
gcloud config set project $GCP_PROJECT_ID

# Enable required APIs
gcloud services enable \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  cloudtasks.googleapis.com
```

### Step 2: Initialize Firestore

Visit: https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore

Click "Create Database" → Choose a region → Start in test mode

### Step 3: Create Pub/Sub Topic

```bash
gcloud pubsub topics create workout-processed
```

### Step 4: Create Service Account & Download Key

```bash
# Create service account
gcloud iam service-accounts create smart-fitness-dev \
  --display-name="Smart Fitness Local Development"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:smart-fitness-dev@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:smart-fitness-dev@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/pubsub.editor"

# Download key
gcloud iam service-accounts keys create ~/smart-fitness-key.json \
  --iam-account=smart-fitness-dev@$GCP_PROJECT_ID.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=~/smart-fitness-key.json
```

### Step 5: Create Cloud Tasks Queue (Optional)

```bash
gcloud tasks queues create stats-aggregation-queue \
  --location=us-central1
```

### Step 6: Run Services with Real GCP

#### Terminal 1: Validator
```bash
cd services/validator
PORT=8080 npm run dev
```

#### Terminal 2: Calculator
```bash
cd services/calculator
PORT=8081 npm run dev
```

#### Terminal 3: Persistence (Real GCP)
```bash
cd services/persistence
PORT=8082 \
  GCP_PROJECT_ID=$GCP_PROJECT_ID \
  GOOGLE_APPLICATION_CREDENTIALS=~/smart-fitness-key.json \
  npm run dev
```

#### Terminal 4: PR-Detector (Real GCP)
```bash
cd services/pr-detector
PORT=8083 \
  GCP_PROJECT_ID=$GCP_PROJECT_ID \
  GOOGLE_APPLICATION_CREDENTIALS=~/smart-fitness-key.json \
  npm run dev
```

#### Terminal 5: Stats-Aggregator (Real GCP)
```bash
cd services/stats-aggregator
PORT=8084 \
  GCP_PROJECT_ID=$GCP_PROJECT_ID \
  GCP_REGION=us-central1 \
  CLOUD_TASKS_QUEUE=stats-aggregation-queue \
  SERVICE_URL=http://localhost:8084 \
  GOOGLE_APPLICATION_CREDENTIALS=~/smart-fitness-key.json \
  npm run dev
```

#### Terminal 6: API Gateway
```bash
cd services/api-gateway
PORT=8085 \
  GCP_PROJECT_ID=$GCP_PROJECT_ID \
  VALIDATOR_SERVICE_URL=http://localhost:8080 \
  CALCULATOR_SERVICE_URL=http://localhost:8081 \
  PERSISTENCE_SERVICE_URL=http://localhost:8082 \
  WORKFLOW_MOCK=true \
  go run main.go
```

---

## Testing the Complete Flow

### End-to-End Test

```bash
# Submit a workout
curl -X POST http://localhost:8082/persist \
  -H "Content-Type: application/json" \
  -d '{
    "validatedData": {
      "userId": "test-user-123",
      "date": "2026-03-23T10:30:00Z",
      "bodyweight": 80.5,
      "exercises": [
        {
          "name": "Squat",
          "category": "squat",
          "weight": 100,
          "reps": 5,
          "sets": 3
        }
      ]
    },
    "calculatedScores": {
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
  }'
```

### Verify in Firestore

Visit: https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/data

You should see:
- `workouts` collection with your workout
- After a few seconds, `user-stats` collection with aggregated data

### Verify Pub/Sub Messages

```bash
# Check if topic received messages
gcloud pubsub topics list

# Pull a test message
gcloud pubsub subscriptions create test-sub --topic=workout-processed
gcloud pubsub subscriptions pull test-sub --auto-ack --limit=1
```

---

## Alternative: Using Docker Compose (Advanced)

For a cleaner setup, you can use Docker Compose:

```bash
# Create docker-compose.yml (I can create this if you want)
docker-compose up
```

This would start all services with one command.

---

## Troubleshooting

### Issue: "Cannot find module"
```bash
cd services/SERVICE_NAME
npm install
```

### Issue: "Port already in use"
```bash
# Find process using port
lsof -ti:8080
# Kill it
kill -9 $(lsof -ti:8080)
```

### Issue: "Authentication error"
```bash
# Verify credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
cat $GOOGLE_APPLICATION_CREDENTIALS | jq .project_id
```

### Issue: "Firestore permission denied"
```bash
# Check Firestore is initialized
gcloud firestore databases list

# Verify service account has permissions
gcloud projects get-iam-policy $GCP_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:smart-fitness-dev@*"
```

---

## Next Steps

1. ✅ **Test Individual Services** - Verify each service works independently
2. ✅ **Test Service Chain** - Validator → Calculator → Persistence
3. ✅ **Test Event Flow** - Verify Pub/Sub triggers PR-Detector
4. ✅ **Test Frontend** - Submit workout through UI
5. ✅ **Ready for GCP Deployment!**

---

## Quick Test Script

I can also create an automated test script that hits all endpoints. Would you like that?
