#!/bin/bash

# Local Service Startup Script
# Starts all microservices in development mode

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Smart Fitness Tracker - Local Development       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}\n"

# Configuration
export NODE_ENV=development
export MOCK_MODE=true

# Service ports
export VALIDATOR_PORT=8080
export CALCULATOR_PORT=8081
export PERSISTENCE_PORT=8082
export PR_DETECTOR_PORT=8083
export STATS_AGGREGATOR_PORT=8084
export API_GATEWAY_PORT=8085

echo -e "${YELLOW}Starting services in mock mode (no GCP required)...${NC}\n"

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Kill any existing processes on our ports
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
for port in 8080 8081 8082 8083 8084 8085 3000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "Killing process on port $port"
        kill -9 $(lsof -ti:$port) 2>/dev/null || true
    fi
done

sleep 2

# Create logs directory
mkdir -p logs

echo -e "\n${GREEN}Starting microservices...${NC}\n"

# Start Validator
echo -e "${BLUE}[1/6]${NC} Starting Validator on port $VALIDATOR_PORT..."
cd services/validator
PORT=$VALIDATOR_PORT npm run dev > ../../logs/validator.log 2>&1 &
VALIDATOR_PID=$!
cd ../..
sleep 2

# Start Calculator
echo -e "${BLUE}[2/6]${NC} Starting Calculator on port $CALCULATOR_PORT..."
cd services/calculator
PORT=$CALCULATOR_PORT npm run dev > ../../logs/calculator.log 2>&1 &
CALCULATOR_PID=$!
cd ../..
sleep 2

# Start Persistence (Mock Mode)
echo -e "${BLUE}[3/6]${NC} Starting Persistence on port $PERSISTENCE_PORT..."
cd services/persistence
PORT=$PERSISTENCE_PORT MOCK_MODE=true npm run dev > ../../logs/persistence.log 2>&1 &
PERSISTENCE_PID=$!
cd ../..
sleep 2

# Start PR-Detector (Mock Mode)
echo -e "${BLUE}[4/6]${NC} Starting PR-Detector on port $PR_DETECTOR_PORT..."
cd services/pr-detector
PORT=$PR_DETECTOR_PORT MOCK_MODE=true npm run dev > ../../logs/pr-detector.log 2>&1 &
PR_DETECTOR_PID=$!
cd ../..
sleep 2

# Start Stats-Aggregator (Mock Mode)
echo -e "${BLUE}[5/6]${NC} Starting Stats-Aggregator on port $STATS_AGGREGATOR_PORT..."
cd services/stats-aggregator
PORT=$STATS_AGGREGATOR_PORT MOCK_MODE=true npm run dev > ../../logs/stats-aggregator.log 2>&1 &
STATS_AGGREGATOR_PID=$!
cd ../..
sleep 2

# Start API Gateway
echo -e "${BLUE}[6/6]${NC} Starting API Gateway on port $API_GATEWAY_PORT..."
cd services/api-gateway
PORT=$API_GATEWAY_PORT \
  WORKFLOW_MOCK=true \
  VALIDATOR_SERVICE_URL=http://localhost:$VALIDATOR_PORT \
  CALCULATOR_SERVICE_URL=http://localhost:$CALCULATOR_PORT \
  PERSISTENCE_SERVICE_URL=http://localhost:$PERSISTENCE_PORT \
  go run main.go > ../../logs/api-gateway.log 2>&1 &
API_GATEWAY_PID=$!
cd ../..

echo -e "\n${YELLOW}Waiting for services to start...${NC}"
sleep 5

# Health checks
echo -e "\n${GREEN}Performing health checks...${NC}\n"

services=(
    "Validator:8080"
    "Calculator:8081"
    "Persistence:8082"
    "PR-Detector:8083"
    "Stats-Aggregator:8084"
    "API-Gateway:8085"
)

all_healthy=true

for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    
    if curl -s http://localhost:$port/health >/dev/null 2>&1; then
        echo -e "  ✅ $name (port $port): ${GREEN}Healthy${NC}"
    else
        echo -e "  ❌ $name (port $port): ${YELLOW}Not responding${NC}"
        all_healthy=false
    fi
done

echo -e "\n${BLUE}════════════════════════════════════════════════════${NC}"

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}✨ All services are running!${NC}\n"
else
    echo -e "${YELLOW}⚠️  Some services may still be starting...${NC}\n"
fi

echo -e "${YELLOW}Service URLs:${NC}"
echo "  • Validator:        http://localhost:8080"
echo "  • Calculator:       http://localhost:8081"
echo "  • Persistence:      http://localhost:8082"
echo "  • PR-Detector:      http://localhost:8083"
echo "  • Stats-Aggregator: http://localhost:8084"
echo "  • API Gateway:      http://localhost:8085"

echo -e "\n${YELLOW}Process IDs:${NC}"
echo "  • Validator:        $VALIDATOR_PID"
echo "  • Calculator:       $CALCULATOR_PID"
echo "  • Persistence:      $PERSISTENCE_PID"
echo "  • PR-Detector:      $PR_DETECTOR_PID"
echo "  • Stats-Aggregator: $STATS_AGGREGATOR_PID"
echo "  • API Gateway:      $API_GATEWAY_PID"

echo -e "\n${YELLOW}Logs:${NC}"
echo "  • View all logs:    tail -f logs/*.log"
echo "  • Validator logs:   tail -f logs/validator.log"
echo "  • All services:     ls -lh logs/"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "  1. Run the test script:  ./test-services.sh"
echo "  2. Start the frontend:   cd frontend && npm run dev"
echo "  3. Stop all services:    ./stop-services.sh"

echo -e "\n${YELLOW}To stop all services:${NC}"
echo "  kill $VALIDATOR_PID $CALCULATOR_PID $PERSISTENCE_PID $PR_DETECTOR_PID $STATS_AGGREGATOR_PID $API_GATEWAY_PID"

# Save PIDs to file for easy cleanup
cat > .service-pids << EOF
VALIDATOR_PID=$VALIDATOR_PID
CALCULATOR_PID=$CALCULATOR_PID
PERSISTENCE_PID=$PERSISTENCE_PID
PR_DETECTOR_PID=$PR_DETECTOR_PID
STATS_AGGREGATOR_PID=$STATS_AGGREGATOR_PID
API_GATEWAY_PID=$API_GATEWAY_PID
EOF

echo -e "\n${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Services are running in the background${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}\n"
