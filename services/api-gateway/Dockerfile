FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api-gateway .

# Production image
FROM alpine:latest

RUN apk --no-cache add ca-certificates

# Create non-root user first
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001

WORKDIR /home/appuser

# Copy the binary from builder
COPY --from=builder /app/api-gateway .

USER appuser

EXPOSE 8080

CMD ["./api-gateway"]
