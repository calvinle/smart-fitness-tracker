#!/bin/bash

# Test Script for All Microservices
# Tests each service independently and then the full flow

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Service URLs
VALIDATOR_URL=${VALIDATOR_URL:-http://localhost:8080}
CALCULATOR_URL=${CALCULATOR_URL:-http://localhost:8081}
PERSISTENCE_URL=${PERSISTENCE_URL:-http://localhost:8082}
PR_DETECTOR_URL=${PR_DETECTOR_URL:-http://localhost:8083}
STATS_AGGREGATOR_URL=${STATS_AGGREGATOR_URL:-http://localhost:8084}
API_GATEWAY_URL=${API_GATEWAY_URL:-http://localhost:8085}

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Smart Fitness Tracker - Service Tests           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"

# Test counter
tests_passed=0
tests_failed=0

# Test function
test_service() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    
    echo -e "${YELLOW}Testing $name...${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "FAILED")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null || echo "FAILED")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "202" ]; then
        echo -e "  ${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        echo -e "  Response: ${body:0:100}..."
        ((tests_passed++))
        return 0
    else
        echo -e "  ${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo -e "  Response: $body"
        ((tests_failed++))
        return 1
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Phase 1: Health Checks${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

test_service "Validator Health" "$VALIDATOR_URL/health"
echo ""

test_service "Calculator Health" "$CALCULATOR_URL/health"
echo ""

test_service "Persistence Health" "$PERSISTENCE_URL/health"
echo ""

test_service "PR-Detector Health" "$PR_DETECTOR_URL/health"
echo ""

test_service "Stats-Aggregator Health" "$STATS_AGGREGATOR_URL/health"
echo ""

test_service "API Gateway Health" "$API_GATEWAY_URL/health"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Phase 2: Service-Specific Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

# Test Validator
workout_data='{
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
    }
  ],
  "duration": 60,
  "notes": "Great session!"
}'

test_service "Validator - Valid Workout" "$VALIDATOR_URL/validate" "POST" "$workout_data"
echo ""

# Test Validator with invalid data
invalid_workout='{
  "userId": "",
  "bodyweight": -10,
  "exercises": []
}'

echo -e "${YELLOW}Testing Validator - Invalid Workout (should fail)...${NC}"
response=$(curl -s -w "\n%{http_code}" -X POST "$VALIDATOR_URL/validate" \
    -H "Content-Type: application/json" \
    -d "$invalid_workout" 2>/dev/null)
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "400" ]; then
    echo -e "  ${GREEN}✓ PASSED${NC} (Correctly rejected invalid data)"
    ((tests_passed++))
else
    echo -e "  ${RED}✗ FAILED${NC} (Should have rejected invalid data)"
    ((tests_failed++))
fi
echo ""

# Test Calculator
calculation_data='{
  "bodyweight": 80.5,
  "gender": "male",
  "exercises": [
    {
      "name": "Squat",
      "category": "squat",
      "weight": 100,
      "reps": 5,
      "sets": 3
    },
    {
      "name": "Bench Press",
      "category": "bench",
      "weight": 80,
      "reps": 5,
      "sets": 3
    },
    {
      "name": "Deadlift",
      "category": "deadlift",
      "weight": 140,
      "reps": 3,
      "sets": 3
    }
  ]
}'

test_service "Calculator - Compute Scores" "$CALCULATOR_URL/calculate" "POST" "$calculation_data"
echo ""

# Test Persistence
persistence_data='{
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

test_service "Persistence - Save Workout" "$PERSISTENCE_URL/persist" "POST" "$persistence_data"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Phase 3: Integration Test (Full Chain)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}Testing full validation → calculation → persistence chain...${NC}"
echo ""

# Step 1: Validate
echo -e "${BLUE}Step 1: Validating workout...${NC}"
validation_response=$(curl -s -X POST "$VALIDATOR_URL/validate" \
    -H "Content-Type: application/json" \
    -d "$workout_data")

if echo "$validation_response" | grep -q '"valid":true'; then
    echo -e "  ${GREEN}✓ Validation passed${NC}"
    validated_data=$(echo "$validation_response" | jq -c '.data')
else
    echo -e "  ${RED}✗ Validation failed${NC}"
    echo "$validation_response"
    exit 1
fi
echo ""

# Step 2: Calculate
echo -e "${BLUE}Step 2: Calculating scores...${NC}"
calc_input=$(echo "$validated_data" | jq -c '{
    bodyweight: .bodyweight,
    gender: "male",
    exercises: .exercises
}')

calculation_response=$(curl -s -X POST "$CALCULATOR_URL/calculate" \
    -H "Content-Type: application/json" \
    -d "$calc_input")

if echo "$calculation_response" | grep -q 'dotsScore'; then
    echo -e "  ${GREEN}✓ Calculation successful${NC}"
    echo "  DOTS Score: $(echo "$calculation_response" | jq -r '.dotsScore')"
    echo "  Wilks Score: $(echo "$calculation_response" | jq -r '.wilksScore')"
    echo "  Total Lifted: $(echo "$calculation_response" | jq -r '.totalLifted') kg"
else
    echo -e "  ${RED}✗ Calculation failed${NC}"
    echo "$calculation_response"
    exit 1
fi
echo ""

# Step 3: Persist
echo -e "${BLUE}Step 3: Persisting to database...${NC}"
persist_input=$(jq -n \
    --argjson validated "$validated_data" \
    --argjson calculated "$calculation_response" \
    '{validatedData: $validated, calculatedScores: $calculated}')

persistence_response=$(curl -s -X POST "$PERSISTENCE_URL/persist" \
    -H "Content-Type: application/json" \
    -d "$persist_input")

if echo "$persistence_response" | grep -q 'success'; then
    echo -e "  ${GREEN}✓ Persistence successful${NC}"
    workout_id=$(echo "$persistence_response" | jq -r '.workoutId // "mock-id"')
    echo "  Workout ID: $workout_id"
    ((tests_passed++))
else
    echo -e "  ${RED}✗ Persistence failed${NC}"
    echo "$persistence_response"
    ((tests_failed++))
fi
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}\n"

total_tests=$((tests_passed + tests_failed))
echo -e "Total Tests:    $total_tests"
echo -e "${GREEN}Passed:         $tests_passed${NC}"
echo -e "${RED}Failed:         $tests_failed${NC}"
echo ""

if [ $tests_failed -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          🎉 All Tests Passed! 🎉                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Start the frontend: cd frontend && npm run dev"
    echo "  2. Visit: http://localhost:3000"
    echo "  3. Submit a workout through the UI"
    echo "  4. Ready to deploy to GCP!"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║          ⚠️  Some Tests Failed  ⚠️                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Check the logs in logs/ directory for details"
    exit 1
fi
