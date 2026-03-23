#!/bin/bash

# Local development setup script
# Sets up the development environment for all services

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Setting up Smart Fitness Tracker development environment...${NC}\n"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "Warning: Go is not installed (needed for API Gateway)"
fi

echo -e "${GREEN}✓ Prerequisites check complete${NC}\n"

# Install dependencies for all Node.js services
echo -e "${YELLOW}Installing dependencies...${NC}"

# Root dependencies
npm install

# Service dependencies
cd services/validator && npm install && cd ../..
cd services/calculator && npm install && cd ../..
cd services/persistence && npm install && cd ../..
cd services/pr-detector && npm install && cd ../..
cd services/stats-aggregator && npm install && cd ../..

# Frontend dependencies
cd frontend && npm install && cd ..

echo -e "${GREEN}✓ All dependencies installed${NC}\n"

# Create .env files
echo -e "${YELLOW}Creating environment configuration files...${NC}"

# Frontend .env
cat > frontend/.env << EOF
VITE_API_GATEWAY_URL=http://localhost:8080
EOF

echo -e "${GREEN}✓ Environment files created${NC}\n"

# Create local development script
cat > dev.sh << 'EOF'
#!/bin/bash

# Local development runner
# Runs all services locally for development

echo "Starting Smart Fitness Tracker services..."

# Set environment variables
export PORT=8080
export GCP_PROJECT_ID=local-dev
export NODE_ENV=development

# Start services in background (in production, use something like pm2 or docker-compose)
echo "Services can be started individually:"
echo "  npm run dev:validator     # Port 8080"
echo "  npm run dev:calculator    # Port 8081"
echo "  npm run dev:persistence   # Port 8082"
echo "  npm run dev:pr-detector   # Port 8083"
echo "  npm run dev:stats-aggregator # Port 8084"
echo "  npm run dev:frontend      # Port 3000"
echo ""
echo "Or start the frontend and point it to deployed services:"
echo "  npm run dev:frontend"
EOF

chmod +x dev.sh

echo -e "${GREEN}✓ Development setup complete!${NC}\n"

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Set up GCP credentials (for Firestore/Pub/Sub):"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json"
echo ""
echo "2. Start development servers:"
echo "   npm run dev:validator     # Validator on port 8080"
echo "   npm run dev:calculator    # Calculator on port 8081"
echo "   npm run dev:persistence   # Persistence on port 8082"
echo "   npm run dev:frontend      # Frontend on port 3000"
echo ""
echo "3. Or use the deployment on GCP and just run the frontend locally"
