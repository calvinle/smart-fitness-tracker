# Smart Fitness Tracker - Architecture Documentation

## System Overview

The Smart Fitness Tracker is a microservices-based application demonstrating modern cloud architecture patterns on Google Cloud Platform (GCP).

### Key Patterns Demonstrated

1. **Orchestration** - GCP Workflows managing sequential service calls
2. **Choreography** - Pub/Sub enabling event-driven, decoupled services
3. **Asynchronous Processing** - Cloud Tasks for background jobs
4. **Serverless Architecture** - Cloud Run for auto-scaling container services
5. **NoSQL Database** - Firestore for flexible, scalable data storage

## Architecture Layers

### 1. Presentation Layer
- **Frontend**: React SPA hosted on Firebase Hosting
- **Responsibilities**: User interface, form validation, status polling

### 2. API Layer
- **API Gateway**: Lightweight Golang service
- **Responsibilities**: Request routing, workflow triggering, status queries
- **Why Golang**: Fast, low memory footprint, excellent for I/O-bound operations

### 3. Orchestration Layer (Phase A - Sequential)
- **GCP Workflows**: Manages the critical path of workout processing
- **Flow**: Validator → Calculator → Persistence
- **Characteristics**:
  - Sequential execution
  - Failure stops the workflow
  - Guaranteed order
  - Synchronous from API Gateway perspective

#### 3.1 Validator Service
- **Language**: Node.js/TypeScript
- **Responsibilities**: Schema validation, business rule checks
- **Libraries**: Zod for type-safe validation
- **Why TypeScript**: Type safety, excellent for data validation

#### 3.2 Calculator Service
- **Language**: Node.js/TypeScript
- **Responsibilities**: DOTS/Wilks score calculation, 1RM estimation
- **Algorithms**: Powerlifting performance formulas
- **Why TypeScript**: Mathematical computations with type safety

#### 3.3 Persistence Service
- **Language**: Node.js/TypeScript
- **Responsibilities**: Firestore writes, Pub/Sub event publishing
- **Dual Role**: 
  - End of orchestrated phase
  - Trigger for choreographed phase

### 4. Choreography Layer (Phase B - Parallel)
- **Event Bus**: Pub/Sub topic `workout-processed`
- **Characteristics**:
  - Event-driven
  - Parallel execution
  - Loosely coupled
  - Independent failure handling

#### 4.1 PR-Detector Service
- **Language**: Node.js/TypeScript
- **Trigger**: Pub/Sub message
- **Responsibilities**: 
  - Compare workout to historical data
  - Detect personal records
  - Send notifications
- **Pattern**: Event consumer, immediate processing

#### 4.2 Stats-Aggregator Service
- **Language**: Node.js/TypeScript
- **Trigger**: Pub/Sub message
- **Responsibilities**:
  - Create Cloud Task for aggregation
  - Process aggregation job
  - Cache results in Firestore
- **Pattern**: Event consumer + Task creator
- **Why Cloud Tasks**: 
  - Aggregation is computationally expensive
  - User shouldn't wait for completion
  - Provides retry logic and rate limiting

## Data Flow

### Synchronous Flow (Orchestrated)
```
1. User submits workout via Frontend
2. Frontend → API Gateway
3. API Gateway triggers GCP Workflow
4. Workflow → Validator (validates)
5. Workflow → Calculator (computes scores)
6. Workflow → Persistence (saves to Firestore)
7. Persistence publishes to Pub/Sub
8. Workflow returns success to API Gateway
9. API Gateway returns execution ID to Frontend
10. Frontend polls for final results
```

### Asynchronous Flow (Choreographed)
```
1. Persistence publishes WORKOUT_PROCESSED event
   ↓
   ├─→ PR-Detector (subscribes via Pub/Sub)
   │   └→ Checks for personal records
   │   └→ Sends notifications
   │
   └─→ Stats-Aggregator (subscribes via Pub/Sub)
       └→ Creates Cloud Task
       └→ Task executes aggregation
       └→ Caches results in Firestore
```

## Technology Choices

### Microservices (Node.js/TypeScript)
**Pros**:
- Unified language across services (easier maintenance)
- Excellent for I/O-bound operations
- Rich ecosystem for data processing
- Type safety via TypeScript
- Fast development

**Cons**:
- Higher memory usage than Golang
- Slower cold starts

**Use Cases**: Business logic, data transformation, validation

### API Gateway (Golang)
**Pros**:
- Extremely low memory footprint (~50MB)
- Fast cold starts (<1s)
- Excellent concurrency model
- Compiled binary (no runtime needed)

**Cons**:
- Less flexible than dynamic languages
- Smaller ecosystem

**Use Cases**: High-throughput API routing, workflow triggering

### GCP Workflows
**Advantages**:
- Managed service (no infrastructure)
- Built-in retry logic
- Visual execution tracking
- YAML-based configuration
- Free tier: 5K steps/month

**Alternative Considered**: Cloud Functions chaining
**Why Workflows Won**: Better visibility, error handling, step orchestration

### Pub/Sub
**Advantages**:
- Fully managed
- At-least-once delivery
- Push and pull subscriptions
- Free tier: 10GB/month

**Pattern**: Pub/Sub for choreography (vs Workflows for orchestration)

### Cloud Tasks
**Advantages**:
- Deduplication
- Rate limiting
- Scheduled execution
- Retry with exponential backoff
- Free tier: 1M operations/month

**Use Case**: Stats aggregation (expensive, can be deferred)

### Firestore
**Advantages**:
- NoSQL flexibility
- Real-time capabilities
- Automatic scaling
- Offline support
- Free tier: 1GB storage, 50K reads/day

**Schema**:
- `workouts`: Individual workout records
- `user-stats`: Aggregated statistics
- `personal-records`: PR tracking
- `notifications`: User notifications

## Scalability

### Auto-Scaling Configuration

**API Gateway**:
- Memory: 128Mi
- Max Instances: 10
- Expected TPS: ~100

**Business Logic Services** (Validator, Calculator, Persistence):
- Memory: 256Mi
- Max Instances: 10
- Expected TPS: ~50 each

**Event Consumers** (PR-Detector, Stats-Aggregator):
- Memory: 256Mi-512Mi
- Max Instances: 5-10
- Triggered by events, not direct traffic

### Bottleneck Analysis

**Potential Bottlenecks**:
1. Firestore writes (limit: 10K writes/second per database)
2. Workflow executions (limit: 5K concurrent)
3. Pub/Sub throughput (unlikely to hit limits)

**Mitigation**:
- Firestore: Batch writes, sharding if needed
- Workflows: Queue requests if hitting limits
- Use Cloud Tasks for rate limiting

## Cost Optimization

### Free Tier Utilization

**Cloud Run**:
- 2M requests/month free
- 360K GB-seconds/month free
- Our estimate: ~100K requests/month = FREE

**Firestore**:
- 1GB storage free
- 50K reads/day free
- Our estimate: ~1000 workouts/month = FREE

**Pub/Sub**:
- 10GB messages/month free
- Our estimate: ~1MB/month = FREE

**Cloud Tasks**:
- 1M operations/month free
- Our estimate: ~5K tasks/month = FREE

**Total Monthly Cost**: $0 (within free tier limits)

## Security

### Authentication & Authorization
- **Frontend**: Firebase Authentication (optional)
- **API Gateway**: Public endpoint (add auth in production)
- **Internal Services**: Cloud Run service-to-service auth
- **Pub/Sub**: Service account based auth

### Best Practices
1. Least privilege IAM roles
2. Service accounts per service
3. VPC for internal communication (production)
4. Secret Manager for sensitive configs
5. HTTPS everywhere (Cloud Run enforces)

## Monitoring & Observability

### Built-in Monitoring
- **Cloud Run**: Request logs, metrics, traces
- **Workflows**: Execution history, step logs
- **Pub/Sub**: Message metrics, delivery stats
- **Firestore**: Read/write metrics

### Recommended Dashboards
1. Request latency per service
2. Workflow success/failure rate
3. Pub/Sub delivery lag
4. Firestore operation counts

## Disaster Recovery

### Data Backup
- **Firestore**: Automatic backups, point-in-time recovery
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 5 minutes

### Service Recovery
- **Cloud Run**: Automatic restarts, health checks
- **Pub/Sub**: Message retention (7 days)
- **Workflows**: Retry failed executions

## Future Enhancements

### Potential Additions
1. **GraphQL API**: Replace REST for frontend
2. **WebSockets**: Real-time updates
3. **Cloud CDN**: Cache static frontend assets
4. **BigQuery**: Long-term analytics
5. **Cloud Scheduler**: Periodic stats updates
6. **Vertex AI**: Exercise form analysis (ML)

### Scaling Beyond Free Tier
1. Optimize container sizes
2. Implement caching (Cloud Memorystore)
3. Use Firestore in Native mode
4. Add Cloud CDN
5. Implement request throttling

## References

- [GCP Workflows Documentation](https://cloud.google.com/workflows/docs)
- [Cloud Run Best Practices](https://cloud.google.com/run/docs/tips)
- [Pub/Sub Patterns](https://cloud.google.com/pubsub/docs/overview)
- [Firestore Data Modeling](https://cloud.google.com/firestore/docs/best-practices)
- [Cloud Tasks Guide](https://cloud.google.com/tasks/docs)
