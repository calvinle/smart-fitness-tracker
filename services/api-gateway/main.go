package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"cloud.google.com/go/workflows/executions/apiv1"
	"cloud.google.com/go/workflows/executions/apiv1/executionspb"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

var (
	port                  = getEnv("PORT", "8080")
	projectID             = os.Getenv("GCP_PROJECT_ID")
	location              = getEnv("GCP_REGION", "us-central1")
	workflowID            = getEnv("WORKFLOW_ID", "workout-processing-workflow")
	workflowMock          = getEnv("WORKFLOW_MOCK", "false") == "true"
	validatorServiceURL   = getEnv("VALIDATOR_SERVICE_URL", "http://localhost:8080")
	calculatorServiceURL  = getEnv("CALCULATOR_SERVICE_URL", "http://localhost:8081")
	persistenceServiceURL = getEnv("PERSISTENCE_SERVICE_URL", "http://localhost:8082")
)

type WorkoutRequest struct {
	UserID     string     `json:"userId"`
	Date       string     `json:"date"`
	Bodyweight float64    `json:"bodyweight"`
	Exercises  []Exercise `json:"exercises"`
	Duration   int        `json:"duration,omitempty"`
	Notes      string     `json:"notes,omitempty"`
}

type Exercise struct {
	Name     string  `json:"name"`
	Category string  `json:"category"`
	Weight   float64 `json:"weight"`
	Reps     int     `json:"reps"`
	Sets     int     `json:"sets"`
	RPE      float64 `json:"rpe,omitempty"`
	Notes    string  `json:"notes,omitempty"`
}

type APIResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	RequestID string      `json:"requestId,omitempty"`
}

func main() {
	router := mux.NewRouter()

	// Health check
	router.HandleFunc("/health", healthCheckHandler).Methods("GET")

	// Main workout submission endpoint
	router.HandleFunc("/api/workout", submitWorkoutHandler).Methods("POST")

	// Get workout status (using path to allow slashes in execution ID)
	router.HandleFunc("/api/workout/{executionId:.*}/status", workoutStatusHandler).Methods("GET")

	// CORS configuration
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // In production, restrict to your frontend domain
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	// Start server
	log.Printf("API Gateway starting on port %s", port)
	if workflowMock {
		log.Println("⚠️  Running in MOCK MODE (no GCP required)")
		log.Printf("  Validator URL:    %s", validatorServiceURL)
		log.Printf("  Calculator URL:   %s", calculatorServiceURL)
		log.Printf("  Persistence URL:  %s", persistenceServiceURL)
	} else {
		log.Println("Running in PRODUCTION MODE")
		log.Printf("  Project: %s, Region: %s, Workflow: %s", projectID, location, workflowID)
	}
	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	response := APIResponse{
		Success: true,
		Message: "API Gateway is healthy",
		Data: map[string]string{
			"service": "api-gateway",
			"version": "1.0.0",
		},
	}
	respondJSON(w, http.StatusOK, response)
}

func submitWorkoutHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Received workout submission request")

	// Parse request body
	var workout WorkoutRequest
	if err := json.NewDecoder(r.Body).Decode(&workout); err != nil {
		log.Printf("Error parsing request: %v", err)
		respondJSON(w, http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	// Basic validation
	if workout.UserID == "" {
		respondJSON(w, http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "userId is required",
		})
		return
	}

	if len(workout.Exercises) == 0 {
		respondJSON(w, http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "At least one exercise is required",
		})
		return
	}

	// Trigger GCP Workflow
	executionID, err := triggerWorkflow(r.Context(), workout)
	if err != nil {
		log.Printf("Error triggering workflow: %v", err)
		respondJSON(w, http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to process workout",
			Message: err.Error(),
		})
		return
	}

	log.Printf("Workflow triggered successfully: %s", executionID)

	// Return success response
	respondJSON(w, http.StatusAccepted, APIResponse{
		Success:   true,
		Message:   "Workout submission accepted and processing started",
		RequestID: executionID,
		Data: map[string]string{
			"executionId": executionID,
			"statusUrl":   fmt.Sprintf("/api/workout/%s/status", executionID),
		},
	})
}

func workoutStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	executionID := vars["executionId"]

	// URL decode the execution ID (it may contain slashes)
	decodedID, err := url.QueryUnescape(executionID)
	if err != nil {
		log.Printf("Error decoding execution ID: %v", err)
		decodedID = executionID
	}

	log.Printf("Checking status for execution: %s", decodedID)

	// Get workflow execution status
	status, err := getWorkflowStatus(r.Context(), decodedID)
	if err != nil {
		log.Printf("Error getting workflow status: %v", err)
		respondJSON(w, http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to get workflow status",
			Message: err.Error(),
		})
		return
	}

	respondJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Data:    status,
	})
}

// triggerWorkflow triggers the GCP Workflow for workout processing
func triggerWorkflow(ctx context.Context, workout WorkoutRequest) (string, error) {
	// Mock mode: simulate workflow by calling services directly
	if workflowMock {
		log.Println("Running in MOCK mode - simulating workflow")
		return simulateWorkflow(ctx, workout)
	}

	client, err := executions.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create executions client: %w", err)
	}
	defer client.Close()

	// Convert workout to JSON for workflow input
	workoutJSON, err := json.Marshal(workout)
	if err != nil {
		return "", fmt.Errorf("failed to marshal workout: %w", err)
	}

	// Create workflow execution request
	workflowName := fmt.Sprintf("projects/%s/locations/%s/workflows/%s", projectID, location, workflowID)

	req := &executionspb.CreateExecutionRequest{
		Parent: workflowName,
		Execution: &executionspb.Execution{
			Argument: string(workoutJSON),
		},
	}

	// Execute workflow
	execution, err := client.CreateExecution(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to create workflow execution: %w", err)
	}

	// Extract execution ID from the execution name
	// Format: projects/*/locations/*/workflows/*/executions/*
	return execution.Name, nil
}

// getWorkflowStatus gets the status of a workflow execution
func getWorkflowStatus(ctx context.Context, executionName string) (map[string]interface{}, error) {
	// Mock mode: return success status
	if workflowMock {
		return map[string]interface{}{
			"executionId": executionName,
			"state":       "SUCCEEDED",
			"startTime":   time.Now().Add(-5 * time.Second).Format(time.RFC3339),
			"endTime":     time.Now().Format(time.RFC3339),
			"result":      "Workout processed successfully (mock mode)",
		}, nil
	}

	client, err := executions.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create executions client: %w", err)
	}
	defer client.Close()

	req := &executionspb.GetExecutionRequest{
		Name: executionName,
	}

	execution, err := client.GetExecution(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get execution: %w", err)
	}

	status := map[string]interface{}{
		"executionId": execution.Name,
		"state":       execution.State.String(),
		"startTime":   execution.StartTime.AsTime().Format(time.RFC3339),
	}

	if execution.EndTime != nil {
		status["endTime"] = execution.EndTime.AsTime().Format(time.RFC3339)
	}

	if execution.Result != "" {
		var result interface{}
		if err := json.Unmarshal([]byte(execution.Result), &result); err == nil {
			status["result"] = result
		}
	}

	if execution.Error != nil {
		status["error"] = execution.Error.String()
	}

	return status, nil
}

// simulateWorkflow simulates the workflow by calling services directly (for local testing)
func simulateWorkflow(ctx context.Context, workout WorkoutRequest) (string, error) {
	executionID := fmt.Sprintf("mock-execution-%d", time.Now().Unix())
	log.Printf("Simulating workflow with ID: %s", executionID)

	// Step 1: Validate
	validatedData, err := callValidator(workout)
	if err != nil {
		return "", fmt.Errorf("validation failed: %w", err)
	}
	log.Println("✓ Validation passed")

	// Step 2: Calculate
	calculatedData, err := callCalculator(validatedData)
	if err != nil {
		return "", fmt.Errorf("calculation failed: %w", err)
	}
	log.Println("✓ Calculation completed")

	// Step 3: Persist
	err = callPersistence(validatedData, calculatedData)
	if err != nil {
		return "", fmt.Errorf("persistence failed: %w", err)
	}
	log.Println("✓ Persistence completed")

	log.Printf("Mock workflow %s completed successfully", executionID)
	return executionID, nil
}

func callValidator(workout WorkoutRequest) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	payload, _ := json.Marshal(workout)
	resp, err := client.Post(validatorServiceURL+"/validate", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to call validator: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode validator response: %w", err)
	}

	if valid, ok := result["valid"].(bool); !ok || !valid {
		return nil, fmt.Errorf("validation failed: %v", result["errors"])
	}

	return result["data"].(map[string]interface{}), nil
}

func callCalculator(validatedData map[string]interface{}) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	calcInput := map[string]interface{}{
		"bodyweight": validatedData["bodyweight"],
		"gender":     "male",
		"exercises":  validatedData["exercises"],
	}
	payload, _ := json.Marshal(calcInput)
	resp, err := client.Post(calculatorServiceURL+"/calculate", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to call calculator: %w", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode calculator response: %w", err)
	}
	return result, nil
}

func callPersistence(validatedData, calculatedData map[string]interface{}) error {
	client := &http.Client{Timeout: 10 * time.Second}
	persistInput := map[string]interface{}{
		"validatedData":    validatedData,
		"calculatedScores": calculatedData,
	}
	payload, _ := json.Marshal(persistInput)
	resp, err := client.Post(persistenceServiceURL+"/persist", "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to call persistence: %w", err)
	}
	defer resp.Body.Close()
	return nil
}

func respondJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
