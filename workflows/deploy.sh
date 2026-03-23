#!/bin/bash

# Deployment script for the workout processing workflow
# This script deploys the GCP Workflow with the correct service URLs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== GCP Workflow Deployment ===${NC}\n"

# Check if required environment variables are set
if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable is not set${NC}"
    exit 1
fi

# Set default values
REGION=${GCP_REGION:-us-central1}
WORKFLOW_NAME="workout-processing-workflow"

echo "Project ID: $GCP_PROJECT_ID"
echo "Region: $REGION"
echo "Workflow Name: $WORKFLOW_NAME"
echo

# Prompt for service URLs (or use environment variables if set)
if [ -z "$VALIDATOR_SERVICE_URL" ]; then
    echo -e "${YELLOW}Enter Validator Service URL:${NC}"
    read VALIDATOR_SERVICE_URL
fi

if [ -z "$CALCULATOR_SERVICE_URL" ]; then
    echo -e "${YELLOW}Enter Calculator Service URL:${NC}"
    read CALCULATOR_SERVICE_URL
fi

if [ -z "$PERSISTENCE_SERVICE_URL" ]; then
    echo -e "${YELLOW}Enter Persistence Service URL:${NC}"
    read PERSISTENCE_SERVICE_URL
fi

echo -e "\n${GREEN}Service URLs:${NC}"
echo "  Validator: $VALIDATOR_SERVICE_URL"
echo "  Calculator: $CALCULATOR_SERVICE_URL"
echo "  Persistence: $PERSISTENCE_SERVICE_URL"
echo

# Create a temporary workflow file with substituted URLs
TEMP_WORKFLOW=$(mktemp)
sed -e "s|\${VALIDATOR_SERVICE_URL}|$VALIDATOR_SERVICE_URL|g" \
    -e "s|\${CALCULATOR_SERVICE_URL}|$CALCULATOR_SERVICE_URL|g" \
    -e "s|\${PERSISTENCE_SERVICE_URL}|$PERSISTENCE_SERVICE_URL|g" \
    workout-processing-workflow.yaml > "$TEMP_WORKFLOW"

echo -e "${GREEN}Deploying workflow...${NC}"

# Deploy the workflow
gcloud workflows deploy "$WORKFLOW_NAME" \
  --source="$TEMP_WORKFLOW" \
  --location="$REGION" \
  --project="$GCP_PROJECT_ID"

# Clean up
rm "$TEMP_WORKFLOW"

echo -e "\n${GREEN}✓ Workflow deployed successfully!${NC}"
echo -e "\nYou can view the workflow at:"
echo "https://console.cloud.google.com/workflows/workflow/$REGION/$WORKFLOW_NAME?project=$GCP_PROJECT_ID"

echo -e "\n${YELLOW}To test the workflow, run:${NC}"
echo "gcloud workflows execute $WORKFLOW_NAME \\"
echo "  --data='{\"userId\":\"test123\",\"date\":\"2026-03-23T10:30:00Z\",\"bodyweight\":80,\"exercises\":[{\"name\":\"Squat\",\"category\":\"squat\",\"weight\":100,\"reps\":5,\"sets\":3}]}' \\"
echo "  --location=$REGION"
