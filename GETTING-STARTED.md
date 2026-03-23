# Getting Started with Smart Fitness Tracker

Complete guide to deploying and running the Smart Fitness Tracker application.

## 🎯 What This Application Demonstrates

This project showcases:
- ✅ **Microservices Architecture** - 6 independent services
- ✅ **Orchestrated Workflows** - GCP Workflows managing sequential logic
- ✅ **Choreographed Workflows** - Pub/Sub for event-driven architecture
- ✅ **Cloud Run** - Serverless container deployment
- ✅ **Cloud Tasks** - Asynchronous background processing
- ✅ **Pub/Sub** - Message-driven communication
- ✅ **Firestore** - NoSQL database
- ✅ **Firebase Hosting** - Static site hosting

## 📋 Prerequisites

### Required Software
- **GCP Account** with billing enabled (free tier is sufficient)
- **gcloud CLI** - [Install](https://cloud.google.com/sdk/docs/install)
- **Node.js 18+** - [Install](https://nodejs.org/)
- **Go 1.21+** - [Install](https://go.dev/doc/install)
- **Docker** - [Install](https://docs.docker.com/get-docker/)
- **Firebase CLI** - Install with `npm install -g firebase-tools`

### GCP Setup
1. Create a new GCP project or use an existing one
2. Enable billing (required for Cloud Run, but free tier covers this app)
3. Install and authenticate gcloud CLI:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## 🚀 Quick Deploy (Recommended)

### Option 1: Automated Deployment

```bash
# Clone the repository
git clone <your-repo-url>
cd smart-fitness-tracker

# Set your GCP project ID
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1

# Run the automated deployment
cd infrastructure
./deploy-all.sh
```

This script will:
1. Enable all required GCP APIs
2. Create Pub/Sub topics and Cloud Tasks queues
3. Deploy all 6 microservices to Cloud Run
4. Deploy the GCP Workflow
5. Set up Pub/Sub subscriptions
6. Display all service URLs

### Option 2: Manual Step-by-Step Deployment

Follow the detailed instructions in [`infrastructure/README.md`](infrastructure/README.md)

## 🌐 Deploy the Frontend

After backend services are deployed:

```bash
cd frontend

# Create environment file with your API Gateway URL
# (This URL is shown at the end of the deployment script)
echo "VITE_API_GATEWAY_URL=https://your-api-gateway-url.run.app" > .env

# Install dependencies and build
npm install
npm run build

# Initialize Firebase (first time only)
firebase login
firebase init hosting
# Choose your project
# Set "dist" as public directory
# Configure as SPA: Yes

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Your app is now live! 🎉

## 🧪 Testing the Application

### 1. Test API Gateway Health

```bash
curl https://your-api-gateway-url.run.app/health
```

Expected response:
```json
{
  "success": true,
  "message": "API Gateway is healthy",
  "data": {
    "service": "api-gateway",
    "version": "1.0.0"
  }
}
```

### 2. Submit a Test Workout

```bash
curl -X POST https://your-api-gateway-url.run.app/api/workout \
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
        "sets": 3,
        "rpe": 8
      },
      {
        "name": "Bench Press",
        "category": "bench",
        "weight": 80,
        "reps": 5,
        "sets": 3,
        "rpe": 7
      },
      {
        "name": "Deadlift",
        "category": "deadlift",
        "weight": 140,
        "reps": 3,
        "sets": 3,
        "rpe": 9
      }
    ],
    "duration": 60,
    "notes": "Great workout session!"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Workout submission accepted and processing started",
  "requestId": "projects/.../executions/...",
  "data": {
    "executionId": "...",
    "statusUrl": "/api/workout/.../status"
  }
}
```

### 3. Check Workflow Status

```bash
# Use the executionId from the previous response
curl https://your-api-gateway-url.run.app/api/workout/EXECUTION_ID/status
```

### 4. Verify in GCP Console

#### Workflow Execution
1. Go to: https://console.cloud.google.com/workflows
2. Click on `workout-processing-workflow`
3. View recent executions

#### Firestore Data
1. Go to: https://console.cloud.google.com/firestore
2. Browse `workouts` collection
3. Check `user-stats` collection for aggregated data

#### Pub/Sub Messages
1. Go to: https://console.cloud.google.com/cloudpubsub
2. View `workout-processed` topic
3. Check subscription metrics

#### Cloud Run Services
1. Go to: https://console.cloud.google.com/run
2. View logs for each service
3. Check request metrics

## 🛠️ Local Development

### Setup Development Environment

```bash
cd infrastructure
./setup-dev.sh
```

This installs all dependencies and creates necessary configuration files.

### Run Services Locally

```bash
# Terminal 1 - Validator
cd services/validator
npm run dev  # Runs on port 8080

# Terminal 2 - Calculator
cd services/calculator
npm run dev  # Runs on port 8081

# Terminal 3 - Persistence
cd services/persistence
export GCP_PROJECT_ID=your-project-id
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
npm run dev  # Runs on port 8082

# Terminal 4 - Frontend
cd frontend
npm run dev  # Runs on port 3000
```

**Note**: For local development, you'll need:
- A service account key file for Firestore/Pub/Sub access
- Actual GCP resources (Firestore, Pub/Sub) or emulators

**Recommended**: Deploy services to GCP and just run frontend locally for development.

## 📊 Understanding the Flow

### Phase A: Orchestrated (Sequential)

```
User submits workout
    ↓
API Gateway receives request
    ↓
Triggers GCP Workflow
    ↓
┌─────────────────────────────────┐
│  Workflow Steps (Sequential)    │
│  1. Validator validates data    │
│  2. Calculator computes scores  │
│  3. Persistence saves to DB     │
└─────────────────────────────────┘
    ↓
Workflow returns success
    ↓
User receives confirmation
```

**Key Point**: If any step fails, the workflow stops and returns an error.

### Phase B: Choreographed (Parallel)

```
Persistence publishes event to Pub/Sub
    ↓
┌────────────────────────────────────┐
│     WORKOUT_PROCESSED Event        │
└────────────────────────────────────┘
    ↓                         ↓
    ↓                         ↓
┌─────────────┐       ┌──────────────────┐
│ PR-Detector │       │ Stats-Aggregator │
│             │       │                  │
│ Checks for  │       │ Creates Cloud    │
│ personal    │       │ Task for         │
│ records     │       │ aggregation      │
│             │       │                  │
│ Sends       │       │ Updates cached   │
│ notification│       │ statistics       │
└─────────────┘       └──────────────────┘
```

**Key Point**: These services run independently and don't block the main workflow.

## 💰 Cost Analysis

All services are configured to stay **FREE** under GCP Free Tier:

| Service | Free Tier Limit | Our Usage | Cost |
|---------|----------------|-----------|------|
| Cloud Run | 2M requests/month | ~100K/month | $0 |
| Firestore | 1GB storage, 50K reads/day | ~100MB, 1K reads/day | $0 |
| Pub/Sub | 10GB messages/month | ~1MB/month | $0 |
| Cloud Tasks | 1M operations/month | ~5K/month | $0 |
| GCP Workflows | 5K steps/month | ~1K/month | $0 |
| Firebase Hosting | 10GB transfer/month | <1GB/month | $0 |

**Total Monthly Cost**: **$0.00** ✨

## 🔍 Monitoring & Debugging

### View Logs

```bash
# Service logs
gcloud run logs read validator --region us-central1 --limit 100

# Workflow logs
gcloud workflows executions list workout-processing-workflow --location us-central1

# Pub/Sub metrics
gcloud pubsub subscriptions describe pr-detector-sub
```

### Common Issues

**Issue**: "Permission denied" during deployment
- **Solution**: Ensure you have Owner or Editor role on the GCP project

**Issue**: Workflow fails at validation step
- **Solution**: Check validator service logs and ensure payload format is correct

**Issue**: No Pub/Sub messages being delivered
- **Solution**: Verify service URLs in subscriptions and check authentication

**Issue**: Stats aggregation not running
- **Solution**: Check Cloud Tasks queue exists and service URL is correct

## 📚 Project Structure

```
smart-fitness-tracker/
├── services/
│   ├── api-gateway/          # Golang API Gateway
│   ├── validator/            # Workout validation (Node.js/TS)
│   ├── calculator/           # Score calculation (Node.js/TS)
│   ├── persistence/          # Firestore + Pub/Sub (Node.js/TS)
│   ├── pr-detector/          # Personal records (Node.js/TS)
│   └── stats-aggregator/     # Background stats (Node.js/TS)
├── workflows/                # GCP Workflows YAML
├── frontend/                 # React SPA
├── infrastructure/           # Deployment scripts
├── README.md                 # Project overview
├── ARCHITECTURE.md          # Detailed architecture
└── GETTING-STARTED.md       # This file
```

## 🎓 Learning Resources

### GCP Services Used
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GCP Workflows Guide](https://cloud.google.com/workflows/docs)
- [Pub/Sub Concepts](https://cloud.google.com/pubsub/docs/overview)
- [Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)

### Architecture Patterns
- [Microservices Pattern](https://microservices.io/)
- [Orchestration vs Choreography](https://www.bmc.com/blogs/orchestration-vs-choreography/)
- [Event-Driven Architecture](https://aws.amazon.com/event-driven-architecture/)

## 🚀 Next Steps

1. **Explore the Code**: Check out individual service READMEs
2. **Modify and Experiment**: Add new features or services
3. **Monitor Performance**: Set up Cloud Monitoring dashboards
4. **Add Authentication**: Integrate Firebase Auth
5. **Implement Features**: 
   - User profiles
   - Social features
   - Exercise library
   - Progress charts

## 🤝 Support

For questions or issues:
1. Check service-specific READMEs
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for design details
3. Check GCP Console logs
4. Review deployment outputs

## 🎉 Congratulations!

You now have a fully functional, cloud-native microservices application demonstrating:
- ✅ Orchestration (GCP Workflows)
- ✅ Choreography (Pub/Sub)
- ✅ Asynchronous Processing (Cloud Tasks)
- ✅ Serverless Computing (Cloud Run)
- ✅ NoSQL Database (Firestore)
- ✅ Event-Driven Architecture
- ✅ Modern Frontend (React)

All running on GCP **for free**! 🎊
