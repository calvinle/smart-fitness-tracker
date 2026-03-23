#!/bin/bash

# Stop all running services

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping all Smart Fitness Tracker services...${NC}\n"

# Try to load PIDs from file
if [ -f .service-pids ]; then
    source .service-pids
    
    echo "Stopping services by PID..."
    
    for pid in $VALIDATOR_PID $CALCULATOR_PID $PERSISTENCE_PID $PR_DETECTOR_PID $STATS_AGGREGATOR_PID $API_GATEWAY_PID; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "  Killing process $pid"
            kill $pid 2>/dev/null || true
        fi
    done
    
    rm .service-pids
fi

# Also kill by port as fallback
echo -e "\nKilling processes by port..."
for port in 8080 8081 8082 8083 8084 8085 3000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "  Killing process on port $port"
        kill -9 $(lsof -ti:$port) 2>/dev/null || true
    fi
done

echo -e "\n${GREEN}✓ All services stopped${NC}\n"
