# Infrastructure & Deployment

This directory contains deployment scripts and infrastructure configuration for the Smart Fitness Tracker application.

## Prerequisites

Before deploying, ensure you have:

1. **GCP Account** with billing enabled
2. **gcloud CLI** installed and configured
3. **Docker** installed
4. **Node.js 18+** and **Go 1.21+** installed
5. **Firebase CLI** installed (`npm install -g firebase-tools`)

## Quick Start

### 1. Set Environment Variables

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
```

### 2. Run Complete Deployment

```bash
cd infrastructure
chmod +x deploy-all.sh
./deploy-all.sh
```

This script will:
- Enable required GCP APIs
- Create Pub/Sub topics and Cloud Tasks queues
- Deploy all 6 microservices to Cloud Run
- Deploy the GCP Workflow
- Set up Pub/Sub subscriptions
- Configure service authentication

## Manual Deployment

If you prefer to deploy services individually:

### Step 1: Enable APIs

```bash
gcloud services enable \
    run.googleapis.com \
    workflows.googleapis.com \
    cloudtasks.googleapis.com \
    pubsub.googleapis.com \
    firestore.googleapis.com \
    cloudbuild.googleapis.com
```

### Step 2: Create Infrastructure

```bash
# Pub/Sub topic
gcloud pubsub topics create workout-processed

# Cloud Tasks queue
gcloud tasks queues create stats-aggregation-queue \
    --location=us-central1

# Initialize Firestore (via console)
# https://console.firebase.google.com/project/YOUR_PROJECT/firestore
```

### Step 3: Deploy Services

Deploy each service from its directory:

```bash
# Validator
cd services/validator
gcloud run deploy validator --source . --region us-central1 --allow-unauthenticated

# Calculator
cd services/calculator
gcloud run deploy calculator --source . --region us-central1 --allow-unauthenticated

# Persistence
cd services/persistence
gcloud run deploy persistence --source . --region us-central1 --allow-unauthenticated \
    --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID

# PR-Detector
cd services/pr-detector
gcloud run deploy pr-detector --source . --region us-central1 --no-allow-unauthenticated \
    --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID

# Stats-Aggregator
cd services/stats-aggregator
gcloud run deploy stats-aggregator --source . --region us-central1 --no-allow-unauthenticated \
    --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,GCP_REGION=us-central1,CLOUD_TASKS_QUEUE=stats-aggregation-queue

# API Gateway
cd services/api-gateway
gcloud run deploy api-gateway --source . --region us-central1 --allow-unauthenticated \
    --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,WORKFLOW_ID=workout-processing-workflow
```

### Step 4: Deploy Workflow

```bash
cd workflows
./deploy.sh
```

### Step 5: Create Pub/Sub Subscriptions

```bash
# PR-Detector subscription
gcloud pubsub subscriptions create pr-detector-sub \
    --topic=workout-processed \
    --push-endpoint=https://pr-detector-XXX.run.app/pubsub \
    --push-auth-service-account=YOUR_SERVICE_ACCOUNT

# Stats-Aggregator subscription
gcloud pubsub subscriptions create stats-aggregator-sub \
    --topic=workout-processed \
    --push-endpoint=https://stats-aggregator-XXX.run.app/pubsub \
    --push-auth-service-account=YOUR_SERVICE_ACCOUNT
```

## Frontend Deployment (Firebase Hosting)

```bash
cd frontend
npm install
npm run build

# Initialize Firebase (first time only)
firebase init hosting

# Deploy
firebase deploy --only hosting
```

## Cost Optimization (Free Tier)

All services are configured to stay within GCP Free Tier limits:

### Cloud Run Free Tier
- 2M requests/month
- 360K GB-seconds/month
- 180K vCPU-seconds/month

**Our Configuration:**
- API Gateway: 128Mi memory, max 10 instances
- Validator, Calculator, Persistence: 256Mi memory, max 10 instances
- PR-Detector: 256Mi memory, max 10 instances
- Stats-Aggregator: 512Mi memory, max 5 instances

### Other Services
- **Firestore**: 1 GiB storage, 50K reads/day (free)
- **Pub/Sub**: 10 GB messages/month (free)
- **Cloud Tasks**: First 1M operations free
- **GCP Workflows**: 5K internal steps/month (free)

## Monitoring

### View Logs

```bash
# Service logs
gcloud run logs read validator --region us-central1 --limit 50

# Workflow logs
gcloud workflows executions list workout-processing-workflow --location us-central1
```

### Cloud Console

- **Cloud Run**: https://console.cloud.google.com/run
- **Workflows**: https://console.cloud.google.com/workflows
- **Pub/Sub**: https://console.cloud.google.com/cloudpubsub
- **Firestore**: https://console.cloud.google.com/firestore

## Testing

### Test API Gateway

```bash
curl https://api-gateway-XXX.run.app/health
```

### Submit Test Workout

```bash
curl -X POST https://api-gateway-XXX.run.app/api/workout \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "date": "2026-03-23T10:30:00Z",
    "bodyweight": 80,
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

### Check Workflow Status

```bash
gcloud workflows executions describe EXECUTION_ID \
  --workflow=workout-processing-workflow \
  --location=us-central1
```

## Cleanup

To delete all resources:

```bash
# Delete Cloud Run services
gcloud run services delete validator calculator persistence pr-detector stats-aggregator api-gateway --region us-central1

# Delete Workflow
gcloud workflows delete workout-processing-workflow --location us-central1

# Delete Pub/Sub
gcloud pubsub subscriptions delete pr-detector-sub stats-aggregator-sub
gcloud pubsub topics delete workout-processed

# Delete Cloud Tasks queue
gcloud tasks queues delete stats-aggregation-queue --location us-central1

# Delete Firestore data (via console)
```

## Troubleshooting

### Common Issues

**Issue**: Service deployment fails with "permission denied"
**Solution**: Ensure you have the required IAM roles (Cloud Run Admin, Workflows Admin, etc.)

**Issue**: Pub/Sub push fails with 403
**Solution**: Ensure the service account has `run.invoker` role on the Cloud Run services

**Issue**: Workflow execution fails
**Solution**: Check that all service URLs are correct in the workflow YAML

**Issue**: Stats aggregation doesn't run
**Solution**: Verify Cloud Tasks queue exists and service URL is configured

## Architecture Diagram

```
User → Frontend (Firebase) → API Gateway (Cloud Run) → GCP Workflow
                                                          ↓
                                        ┌─────────────────┼─────────────────┐
                                        ↓                 ↓                 ↓
                                   Validator         Calculator      Persistence
                                   (Cloud Run)      (Cloud Run)      (Cloud Run)
                                                                          ↓
                                                                    Pub/Sub Topic
                                                                    ↙          ↘
                                                            PR-Detector    Stats-Aggregator
                                                           (Cloud Run)      (Cloud Run)
                                                                               ↓
                                                                         Cloud Tasks
```

## Support

For issues or questions:
1. Check service logs in Cloud Console
2. Review individual service READMEs
3. Verify environment variables are set correctly
4. Ensure all APIs are enabled
