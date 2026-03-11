package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"local-runner/internal/auth"
	"local-runner/internal/config"
	"local-runner/internal/python"
)

type Server struct {
	config         config.Config
	validator      auth.Validator
	runner         *python.Runner
	sessionManager *python.SessionManager
}

type errorResponse struct {
	Error string `json:"error"`
}

type infoResponse struct {
	Status              string                  `json:"status"`
	ListenAddress       string                  `json:"listenAddress"`
	AllowedOrigins      []string                `json:"allowedOrigins"`
	SupportsInteractive bool                    `json:"supportsInteractive"`
	Python              *python.ResolvedCommand `json:"python,omitempty"`
}

type createSessionResponse struct {
	Session python.SessionSummary `json:"session"`
}

type stdinRequest struct {
	Data string `json:"data"`
}

func New(cfg config.Config) *http.Server {
	runner := python.NewRunner(cfg.Python, cfg.MaxRunSeconds, cfg.WorkDir)
	s := &Server{
		config:         cfg,
		validator:      auth.NewValidator(cfg.AllowedOrigins, cfg.SharedToken),
		runner:         runner,
		sessionManager: python.NewSessionManager(runner),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/v1/info", s.handleInfo)
	mux.HandleFunc("/v1/run", s.handleRun)
	mux.HandleFunc("/v1/sessions", s.handleSessions)
	mux.HandleFunc("/v1/sessions/", s.handleSessionRoutes)

	return &http.Server{
		Addr:              cfg.ListenAddress(),
		Handler:           s.loggingMiddleware(s.corsMiddleware(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeMethodNotAllowed(w)
		return
	}

	response := infoResponse{
		Status:              "ok",
		ListenAddress:       s.config.ListenAddress(),
		AllowedOrigins:      s.config.AllowedOrigins,
		SupportsInteractive: true,
	}

	if resolved, err := s.runner.Resolve(); err == nil {
		response.Python = resolved
	}

	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeMethodNotAllowed(w)
		return
	}

	if err := s.validator.ValidateRequest(r); err != nil {
		s.writeAuthError(w, err)
		return
	}

	resolved, err := s.runner.Resolve()
	if err != nil && !errors.Is(err, python.ErrPythonNotFound) {
		s.writeJSON(w, http.StatusInternalServerError, errorResponse{Error: err.Error()})
		return
	}

	response := infoResponse{
		Status:              "ok",
		ListenAddress:       s.config.ListenAddress(),
		AllowedOrigins:      s.config.AllowedOrigins,
		SupportsInteractive: true,
		Python:              resolved,
	}

	s.writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeMethodNotAllowed(w)
		return
	}

	if err := s.validator.ValidateRequest(r); err != nil {
		s.writeAuthError(w, err)
		return
	}

	var request python.ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		s.writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid json body"})
		return
	}

	result, err := s.runner.Run(request)
	if err != nil {
		s.writeRunError(w, err)
		return
	}

	s.writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSessions(w http.ResponseWriter, r *http.Request) {
	if err := s.validator.ValidateRequest(r); err != nil {
		s.writeAuthError(w, err)
		return
	}

	if r.Method != http.MethodPost {
		s.writeMethodNotAllowed(w)
		return
	}

	var request python.ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		s.writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid json body"})
		return
	}

	session, err := s.sessionManager.Create(request)
	if err != nil {
		s.writeRunError(w, err)
		return
	}

	s.writeJSON(w, http.StatusOK, createSessionResponse{
		Session: session.Summary(),
	})
}

func (s *Server) handleSessionRoutes(w http.ResponseWriter, r *http.Request) {
	if err := s.validator.ValidateRequest(r); err != nil {
		s.writeAuthError(w, err)
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/v1/sessions/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[0] == "" {
		s.writeJSON(w, http.StatusNotFound, errorResponse{Error: "session route not found"})
		return
	}

	sessionID := parts[0]
	action := parts[1]

	session, err := s.sessionManager.Get(sessionID)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, python.ErrSessionNotFound) {
			statusCode = http.StatusNotFound
		}
		s.writeJSON(w, statusCode, errorResponse{Error: err.Error()})
		return
	}

	switch action {
	case "stream":
		s.handleSessionStream(w, r, session)
	case "stdin":
		s.handleSessionInput(w, r, session)
	case "stop":
		s.handleSessionStop(w, r, session)
	default:
		s.writeJSON(w, http.StatusNotFound, errorResponse{Error: "session route not found"})
	}
}

func (s *Server) handleSessionStream(w http.ResponseWriter, r *http.Request, session *python.Session) {
	if r.Method != http.MethodGet {
		s.writeMethodNotAllowed(w)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		s.writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	for _, event := range session.History() {
		if err := s.writeSSE(w, event); err != nil {
			return
		}
		flusher.Flush()
	}

	if !session.IsRunning() {
		return
	}

	events, unsubscribe := session.Subscribe()
	defer unsubscribe()

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": keep-alive\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}
			if err := s.writeSSE(w, event); err != nil {
				return
			}
			flusher.Flush()
			if event.Type == "exit" {
				return
			}
		}
	}
}

func (s *Server) handleSessionInput(w http.ResponseWriter, r *http.Request, session *python.Session) {
	if r.Method != http.MethodPost {
		s.writeMethodNotAllowed(w)
		return
	}

	var request stdinRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		s.writeJSON(w, http.StatusBadRequest, errorResponse{Error: "invalid json body"})
		return
	}

	if err := session.WriteInput(request.Data); err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, python.ErrSessionNotRunning) {
			statusCode = http.StatusConflict
		}
		s.writeJSON(w, statusCode, errorResponse{Error: err.Error()})
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleSessionStop(w http.ResponseWriter, r *http.Request, session *python.Session) {
	if r.Method != http.MethodPost {
		s.writeMethodNotAllowed(w)
		return
	}

	if err := session.Stop(); err != nil {
		statusCode := http.StatusInternalServerError
		if errors.Is(err, python.ErrSessionNotRunning) {
			statusCode = http.StatusConflict
		}
		s.writeJSON(w, statusCode, errorResponse{Error: err.Error()})
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && s.validator.IsOriginAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Runner-Token")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		next.ServeHTTP(w, r)
	})
}

func (s *Server) writeRunError(w http.ResponseWriter, err error) {
	statusCode := http.StatusInternalServerError
	switch {
	case errors.Is(err, python.ErrPythonNotFound):
		statusCode = http.StatusServiceUnavailable
	case errors.Is(err, python.ErrCodeRequired):
		statusCode = http.StatusBadRequest
	}
	s.writeJSON(w, statusCode, errorResponse{Error: err.Error()})
}

func (s *Server) writeAuthError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrOriginNotAllowed):
		s.writeJSON(w, http.StatusForbidden, errorResponse{Error: err.Error()})
	case errors.Is(err, auth.ErrInvalidToken):
		s.writeJSON(w, http.StatusUnauthorized, errorResponse{Error: err.Error()})
	default:
		s.writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "unauthorized"})
	}
}

func (s *Server) writeMethodNotAllowed(w http.ResponseWriter) {
	s.writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
}

func (s *Server) writeSSE(w http.ResponseWriter, event python.TerminalEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
		return err
	}
	return nil
}

func (s *Server) writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(statusCode)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response: %v", err)
	}
}
