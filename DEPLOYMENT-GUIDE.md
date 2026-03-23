# GCP Deployment Guide - Incremental Deployment

Deploy the Smart Fitness Tracker microservices to Google Cloud Platform in a logical order.

## Prerequisites

1. **Install Google Cloud SDK**: https://cloud.google.com/sdk/docs/install
2. **Verify installation**: `gcloud --version`
3. **Have your GCP Project ID ready** (you mentioned you already initialized one)

---

## Phase 0: Initial Setup (Cloud Console + CLI)

### Step 0.1: Authenticate and Set Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (REPLACE with your actual project ID)
export PROJECT_ID="your-project-id-here"
gcloud config set project $PROJECT_ID

# Enable required APIs (this takes 2-3 minutes)
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  workflows.googleapis.com \
  firestore.googleapis.com \
  pubsub.googleapis.com \
  cloudtasks.googleapis.com \
  firebase.googleapis.com

# Verify your project is set correctly
gcloud config get-value project
```

### Step 0.2: Set Default Region

```bash
export REGION=us-central1
gcloud config set run/region $REGION
```

---

## Phase 1: Setup Infrastructure (Databases & Message Queues)

### Step 1.1: Initialize Firestore Database

**Cloud Console Steps:**
1. Go to https://console.cloud.google.com/firestore
2. Click "Select Native Mode" (NOT Datastore mode)
3. Choose region: `us-central1` (Iowa)
4. Click "Create Database"
5. Wait ~1 minute for provisioning

**Verify via CLI:**
```bash
# Check Firestore is enabled
gcloud firestore databases list
```

### Step 1.2: Create Pub/Sub Topic

```bash
# Create the topic for workout processed events
gcloud pubsub topics create workout-processed

# Verify topic was created
gcloud pubsub topics list
```

### Step 1.3: Create Cloud Tasks Queue

```bash
# Create queue for stats aggregation
gcloud tasks queues create stats-aggregation-queue \
  --location=$REGION

# Verify queue was created
gcloud tasks queues list --location=$REGION
```

**✅ Phase 1 Complete!** Infrastructure is ready.

---

## Phase 2: Deploy Core Processing Services

These services process workouts but don't initiate the workflow.

### Step 2.1: Deploy Validator Service

```bash
cd services/validator

# Deploy to Cloud Run
gcloud run deploy validator \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1

# Save the URL (you'll need it)
export VALIDATOR_URL=$(gcloud run services describe validator --region=$REGION --format='value(status.url)')
echo "Validator URL: $VALIDATOR_URL"

cd ../..
```

**Expected output:** URL like `https://validator-abc123-uc.a.run.app`

### Step 2.2: Deploy Calculator Service

```bash
cd services/calculator

gcloud run deploy calculator \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1

export CALCULATOR_URL=$(gcloud run services describe calculator --region=$REGION --format='value(status.url)')
echo "Calculator URL: $CALCULATOR_URL"

cd ../..
```

### Step 2.3: Deploy Persistence Service

```bash
cd services/persistence

# Deploy with Firestore and Pub/Sub access
gcloud run deploy persistence \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=5 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID,PUBSUB_TOPIC=workout-processed

export PERSISTENCE_URL=$(gcloud run services describe persistence --region=$REGION --format='value(status.url)')
echo "Persistence URL: $PERSISTENCE_URL"

cd ../..
```

### Step 2.4: Deploy PR-Detector Service

```bash
cd services/pr-detector

gcloud run deploy pr-detector \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=5 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID

export PR_DETECTOR_URL=$(gcloud run services describe pr-detector --region=$REGION --format='value(status.url)')
echo "PR-Detector URL: $PR_DETECTOR_URL"

cd ../..
```

**Now create Pub/Sub subscription to trigger PR-Detector:**

```bash
# Create push subscription
gcloud pubsub subscriptions create pr-detector-subscription \
  --topic=workout-processed \
  --push-endpoint="$PR_DETECTOR_URL/pubsub" \
  --ack-deadline=60

# Verify subscription
gcloud pubsub subscriptions list
```

### Step 2.5: Deploy Stats-Aggregator Service

```bash
cd services/stats-aggregator

gcloud run deploy stats-aggregator \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=5 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID,REGION=$REGION,QUEUE_NAME=stats-aggregation-queue

export STATS_AGGREGATOR_URL=$(gcloud run services describe stats-aggregator --region=$REGION --format='value(status.url)')
echo "Stats-Aggregator URL: $STATS_AGGREGATOR_URL"

cd ../..
```

**✅ Phase 2 Complete!** All processing services are deployed.

---

## Phase 3: Deploy Workflow (Orchestration)

### Step 3.1: Update Workflow YAML with Real URLs

```bash
# Create production workflow file
cat > workflows/workout-processing-workflow-prod.yaml << EOF
main:
  params: [workout]
  steps:
    - validate:
        call: http.post
        args:
          url: ${VALIDATOR_URL}/validate
          body: \${workout}
          auth:
            type: OIDC
        result: validationResult
    
    - checkValidation:
        switch:
          - condition: \${validationResult.body.valid == false}
            return: \${validationResult.body}
    
    - calculate:
        call: http.post
        args:
          url: ${CALCULATOR_URL}/calculate
          body:
            bodyweight: \${validationResult.body.data.bodyweight}
            gender: "male"
            exercises: \${validationResult.body.data.exercises}
          auth:
            type: OIDC
        result: calculationResult
    
    - persist:
        call: http.post
        args:
          url: ${PERSISTENCE_URL}/persist
          body:
            validatedData: \${validationResult.body.data}
            calculatedScores: \${calculationResult.body}
          auth:
            type: OIDC
        result: persistenceResult
    
    - returnSuccess:
        return: \${persistenceResult.body}
EOF
```

### Step 3.2: Deploy Workflow

```bash
cd workflows

# Deploy the workflow
gcloud workflows deploy workout-processing-workflow \
  --source=workout-processing-workflow-prod.yaml \
  --location=$REGION

# Verify deployment
gcloud workflows describe workout-processing-workflow --location=$REGION

cd ..
```

**✅ Phase 3 Complete!** Workflow orchestration is ready.

---

## Phase 4: Deploy API Gateway

### Step 4.1: Build and Deploy API Gateway

```bash
cd services/api-gateway

# Deploy with workflow configuration
gcloud run deploy api-gateway \
  --source . \
  --region=$REGION \
  --allow-unauthenticated \
  --max-instances=10 \
  --memory=128Mi \
  --cpu=1 \
  --set-env-vars=GCP_PROJECT_ID=$PROJECT_ID,GCP_REGION=$REGION,WORKFLOW_ID=workout-processing-workflow

export API_GATEWAY_URL=$(gcloud run services describe api-gateway --region=$REGION --format='value(status.url)')
echo "API Gateway URL: $API_GATEWAY_URL"

# Test the health endpoint
curl $API_GATEWAY_URL/health

cd ../..
```

**✅ Phase 4 Complete!** API Gateway is live.

---

## Phase 5: Deploy Frontend

### Step 5.1: Setup Firebase Hosting

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting
```

**When prompted:**
- Select your existing GCP project
- Public directory: `frontend/dist`
- Single-page app: **Yes**
- Automatic builds: **No**
- Don't overwrite index.html

### Step 5.2: Configure Frontend with Production API URL

```bash
cd frontend

# Create production environment file
cat > .env.production << EOF
VITE_API_GATEWAY_URL=$API_GATEWAY_URL
EOF

# Build for production
npm run build

cd ..
```

### Step 5.3: Deploy to Firebase Hosting

```bash
# Deploy
firebase deploy --only hosting

# Get your frontend URL
firebase hosting:sites:list
```

**✅ Phase 5 Complete!** Frontend is live!

---

## Phase 6: Verification & Testing

### Step 6.1: Test the Full Flow

```bash
# Test workout submission
curl -X POST $API_GATEWAY_URL/api/workout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "bodyweight": 80,
    "exercises": [{
      "name": "Squat",
      "category": "squat",
      "weight": 100,
      "reps": 5,
      "sets": 3,
      "rpe": 8
    }]
  }'
```

### Step 6.2: Check Logs

```bash
# View API Gateway logs
gcloud run services logs read api-gateway --region=$REGION --limit=50

# View Validator logs
gcloud run services logs read validator --region=$REGION --limit=50

# View Workflow executions
gcloud workflows executions list workout-processing-workflow --location=$REGION
```

### Step 6.3: Visit Your Frontend

Open the Firebase Hosting URL in your browser and submit a workout!

---

## Cost Monitoring

### Set up Budget Alerts (Cloud Console)

1. Go to https://console.cloud.google.com/billing/budgets
2. Click "Create Budget"
3. Set budget amount: $10/month
4. Set alert thresholds: 50%, 90%, 100%
5. Add your email for notifications

### View Current Costs

```bash
# Check current month usage
gcloud billing accounts list

# View cost details in Cloud Console
# https://console.cloud.google.com/billing
```

---

## Troubleshooting Commands

```bash
# View service details
gcloud run services describe SERVICE_NAME --region=$REGION

# View recent logs
gcloud run services logs read SERVICE_NAME --region=$REGION --limit=100

# List all Cloud Run services
gcloud run services list --region=$REGION

# Test individual service
curl https://SERVICE-URL/health

# View Pub/Sub subscriptions
gcloud pubsub subscriptions list

# View Cloud Tasks queues
gcloud tasks queues list --location=$REGION

# View Firestore collections (Cloud Console only)
# https://console.cloud.google.com/firestore/data
```

---

## Summary of Deployment Order

1. ✅ Infrastructure (Firestore, Pub/Sub, Cloud Tasks)
2. ✅ Validator → Calculator → Persistence (core services)
3. ✅ PR-Detector (choreographed service + Pub/Sub subscription)
4. ✅ Stats-Aggregator (choreographed service)
5. ✅ Workflow (orchestration)
6. ✅ API Gateway (entry point)
7. ✅ Frontend (user interface)

---

## Quick Reference: All URLs

Save these for future reference:

```bash
echo "PROJECT_ID: $PROJECT_ID"
echo "REGION: $REGION"
echo "Validator: $VALIDATOR_URL"
echo "Calculator: $CALCULATOR_URL"
echo "Persistence: $PERSISTENCE_URL"
echo "PR-Detector: $PR_DETECTOR_URL"
echo "Stats-Aggregator: $STATS_AGGREGATOR_URL"
echo "API Gateway: $API_GATEWAY_URL"
echo "Frontend: (get from Firebase console)"
```

Ready to start? Begin with **Phase 0!** 🚀
