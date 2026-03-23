package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/workflows/apiv1/workflowspb"
	"cloud.google.com/go/workflows/executions/apiv1"
	"cloud.google.com/go/workflows/executions/apiv1/executionspb"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

var (
	port       = getEnv("PORT", "8080")
	projectID  = os.Getenv("GCP_PROJECT_ID")
	location   = getEnv("GCP_REGION", "us-central1")
	workflowID = getEnv("WORKFLOW_ID", "workout-processing-workflow")
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

	// Get workout status
	router.HandleFunc("/api/workout/{executionId}/status", workoutStatusHandler).Methods("GET")

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
	log.Printf("Project: %s, Region: %s, Workflow: %s", projectID, location, workflowID)
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

	log.Printf("Checking status for execution: %s", executionID)

	// Get workflow execution status
	status, err := getWorkflowStatus(r.Context(), executionID)
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

	if execution.Result != nil {
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
