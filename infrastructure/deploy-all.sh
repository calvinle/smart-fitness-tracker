#!/bin/bash

# Complete deployment script for Smart Fitness Tracker
# Deploys all microservices to GCP Cloud Run and sets up infrastructure

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Smart Fitness Tracker - GCP Deployment          ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Get project configuration
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${YELLOW}Enter your GCP Project ID:${NC}"
    read GCP_PROJECT_ID
fi

REGION=${GCP_REGION:-us-central1}
echo -e "${GREEN}Project ID: $GCP_PROJECT_ID${NC}"
echo -e "${GREEN}Region: $REGION${NC}\n"

# Set gcloud project
gcloud config set project "$GCP_PROJECT_ID"

# Enable required APIs
echo -e "${YELLOW}Enabling required GCP APIs...${NC}"
gcloud services enable \
    run.googleapis.com \
    workflows.googleapis.com \
    cloudtasks.googleapis.com \
    pubsub.googleapis.com \
    firestore.googleapis.com \
    cloudbuild.googleapis.com

echo -e "${GREEN}✓ APIs enabled${NC}\n"

# Create Pub/Sub topic
echo -e "${YELLOW}Creating Pub/Sub topic...${NC}"
gcloud pubsub topics create workout-processed --project="$GCP_PROJECT_ID" || echo "Topic already exists"
echo -e "${GREEN}✓ Pub/Sub topic created${NC}\n"

# Create Cloud Tasks queue
echo -e "${YELLOW}Creating Cloud Tasks queue...${NC}"
gcloud tasks queues create stats-aggregation-queue \
    --location="$REGION" \
    --project="$GCP_PROJECT_ID" || echo "Queue already exists"
echo -e "${GREEN}✓ Cloud Tasks queue created${NC}\n"

# Initialize Firestore
echo -e "${YELLOW}Note: Please ensure Firestore is initialized in your project${NC}"
echo -e "${YELLOW}Visit: https://console.firebase.google.com/project/$GCP_PROJECT_ID/firestore${NC}\n"

# Deploy microservices
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Deploying Microservices to Cloud Run${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# 1. Deploy Validator
echo -e "${YELLOW}[1/6] Deploying Validator service...${NC}"
cd services/validator
gcloud run deploy validator \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --max-instances 10 \
    --memory 256Mi \
    --project="$GCP_PROJECT_ID"
VALIDATOR_URL=$(gcloud run services describe validator --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ Validator deployed: $VALIDATOR_URL${NC}\n"
cd ../..

# 2. Deploy Calculator
echo -e "${YELLOW}[2/6] Deploying Calculator service...${NC}"
cd services/calculator
gcloud run deploy calculator \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --max-instances 10 \
    --memory 256Mi \
    --project="$GCP_PROJECT_ID"
CALCULATOR_URL=$(gcloud run services describe calculator --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ Calculator deployed: $CALCULATOR_URL${NC}\n"
cd ../..

# 3. Deploy Persistence
echo -e "${YELLOW}[3/6] Deploying Persistence service...${NC}"
cd services/persistence
gcloud run deploy persistence \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --max-instances 10 \
    --memory 256Mi \
    --set-env-vars GCP_PROJECT_ID="$GCP_PROJECT_ID" \
    --project="$GCP_PROJECT_ID"
PERSISTENCE_URL=$(gcloud run services describe persistence --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ Persistence deployed: $PERSISTENCE_URL${NC}\n"
cd ../..

# 4. Deploy PR-Detector
echo -e "${YELLOW}[4/6] Deploying PR-Detector service...${NC}"
cd services/pr-detector
gcloud run deploy pr-detector \
    --source . \
    --region "$REGION" \
    --no-allow-unauthenticated \
    --max-instances 10 \
    --memory 256Mi \
    --set-env-vars GCP_PROJECT_ID="$GCP_PROJECT_ID" \
    --project="$GCP_PROJECT_ID"
PR_DETECTOR_URL=$(gcloud run services describe pr-detector --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ PR-Detector deployed: $PR_DETECTOR_URL${NC}\n"
cd ../..

# 5. Deploy Stats-Aggregator
echo -e "${YELLOW}[5/6] Deploying Stats-Aggregator service...${NC}"
cd services/stats-aggregator
gcloud run deploy stats-aggregator \
    --source . \
    --region "$REGION" \
    --no-allow-unauthenticated \
    --max-instances 5 \
    --memory 512Mi \
    --set-env-vars GCP_PROJECT_ID="$GCP_PROJECT_ID",GCP_REGION="$REGION",CLOUD_TASKS_QUEUE=stats-aggregation-queue \
    --project="$GCP_PROJECT_ID"
STATS_AGGREGATOR_URL=$(gcloud run services describe stats-aggregator --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ Stats-Aggregator deployed: $STATS_AGGREGATOR_URL${NC}\n"
cd ../..

# Update Stats-Aggregator with SERVICE_URL
gcloud run services update stats-aggregator \
    --region "$REGION" \
    --update-env-vars SERVICE_URL="$STATS_AGGREGATOR_URL" \
    --project="$GCP_PROJECT_ID"

# 6. Deploy API Gateway
echo -e "${YELLOW}[6/6] Deploying API Gateway...${NC}"
cd services/api-gateway
gcloud run deploy api-gateway \
    --source . \
    --region "$REGION" \
    --allow-unauthenticated \
    --max-instances 10 \
    --memory 128Mi \
    --set-env-vars GCP_PROJECT_ID="$GCP_PROJECT_ID",GCP_REGION="$REGION",WORKFLOW_ID=workout-processing-workflow \
    --project="$GCP_PROJECT_ID"
API_GATEWAY_URL=$(gcloud run services describe api-gateway --region="$REGION" --format='value(status.url)' --project="$GCP_PROJECT_ID")
echo -e "${GREEN}✓ API Gateway deployed: $API_GATEWAY_URL${NC}\n"
cd ../..

# Deploy Workflow
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Deploying GCP Workflow${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

cd workflows
VALIDATOR_SERVICE_URL="$VALIDATOR_URL" \
CALCULATOR_SERVICE_URL="$CALCULATOR_URL" \
PERSISTENCE_SERVICE_URL="$PERSISTENCE_URL" \
./deploy.sh
cd ..

# Create Pub/Sub subscriptions
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Setting up Pub/Sub Subscriptions${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Get service account email for Cloud Run
SERVICE_ACCOUNT=$(gcloud run services describe pr-detector --region="$REGION" --format='value(spec.template.spec.serviceAccountName)' --project="$GCP_PROJECT_ID")

if [ -z "$SERVICE_ACCOUNT" ]; then
    SERVICE_ACCOUNT="$GCP_PROJECT_ID@appspot.gserviceaccount.com"
fi

echo -e "${YELLOW}Creating PR-Detector subscription...${NC}"
gcloud pubsub subscriptions create pr-detector-sub \
    --topic=workout-processed \
    --push-endpoint="$PR_DETECTOR_URL/pubsub" \
    --push-auth-service-account="$SERVICE_ACCOUNT" \
    --project="$GCP_PROJECT_ID" || echo "Subscription already exists"

echo -e "${YELLOW}Creating Stats-Aggregator subscription...${NC}"
gcloud pubsub subscriptions create stats-aggregator-sub \
    --topic=workout-processed \
    --push-endpoint="$STATS_AGGREGATOR_URL/pubsub" \
    --push-auth-service-account="$SERVICE_ACCOUNT" \
    --project="$GCP_PROJECT_ID" || echo "Subscription already exists"

echo -e "${GREEN}✓ Pub/Sub subscriptions created${NC}\n"

# Print summary
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deployment Complete! 🎉                          ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}\n"

echo -e "${GREEN}Service URLs:${NC}"
echo -e "  API Gateway:       $API_GATEWAY_URL"
echo -e "  Validator:         $VALIDATOR_URL"
echo -e "  Calculator:        $CALCULATOR_URL"
echo -e "  Persistence:       $PERSISTENCE_URL"
echo -e "  PR-Detector:       $PR_DETECTOR_URL"
echo -e "  Stats-Aggregator:  $STATS_AGGREGATOR_URL"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "1. Deploy the frontend:"
echo -e "   cd frontend"
echo -e "   echo 'VITE_API_GATEWAY_URL=$API_GATEWAY_URL' > .env"
echo -e "   npm run build"
echo -e "   firebase deploy --only hosting"
echo -e "\n2. Test the API Gateway:"
echo -e "   curl $API_GATEWAY_URL/health"
echo -e "\n3. Monitor your services:"
echo -e "   https://console.cloud.google.com/run?project=$GCP_PROJECT_ID"

echo -e "\n${GREEN}All services deployed successfully!${NC}\n"
