package python

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"time"
)

var ErrSessionNotFound = errors.New("session not found")
var ErrSessionNotRunning = errors.New("session not running")

type TerminalEvent struct {
	Type       string           `json:"type"`
	Data       string           `json:"data,omitempty"`
	Message    string           `json:"message,omitempty"`
	Command    *ResolvedCommand `json:"command,omitempty"`
	ExitCode   *int             `json:"exitCode,omitempty"`
	DurationMs int64            `json:"durationMs,omitempty"`
	TimedOut   bool             `json:"timedOut,omitempty"`
}

type SessionSummary struct {
	ID        string          `json:"id"`
	Command   ResolvedCommand `json:"command"`
	Running   bool            `json:"running"`
	StartedAt time.Time       `json:"startedAt"`
}

type Session struct {
	id          string
	command     ResolvedCommand
	startedAt   time.Time
	running     bool
	cancel      context.CancelFunc
	stdin       io.WriteCloser
	cleanup     func()
	history     []TerminalEvent
	subscribers map[chan TerminalEvent]struct{}
	mu          sync.RWMutex
}

type SessionManager struct {
	runner   *Runner
	sessions map[string]*Session
	mu       sync.RWMutex
}

func NewSessionManager(runner *Runner) *SessionManager {
	return &SessionManager{
		runner:   runner,
		sessions: make(map[string]*Session),
	}
}

func (m *SessionManager) Create(request ExecutionRequest) (*Session, error) {
	prepared, err := m.runner.prepareExecution(request)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		time.Duration(prepared.timeoutSeconds)*time.Second,
	)

	commandArgs := append(append([]string{}, prepared.command.Args...), "-u", prepared.filename)
	cmd := exec.CommandContext(ctx, prepared.command.Name, commandArgs...)
	cmd.Dir = prepared.runDir

	stdinPipe, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		_ = os.RemoveAll(prepared.runDir)
		return nil, fmt.Errorf("create stdin pipe: %w", err)
	}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		_ = stdinPipe.Close()
		_ = os.RemoveAll(prepared.runDir)
		return nil, fmt.Errorf("create stdout pipe: %w", err)
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		_ = stdinPipe.Close()
		_ = os.RemoveAll(prepared.runDir)
		return nil, fmt.Errorf("create stderr pipe: %w", err)
	}

	sessionID, err := randomID()
	if err != nil {
		cancel()
		_ = stdinPipe.Close()
		_ = os.RemoveAll(prepared.runDir)
		return nil, fmt.Errorf("generate session id: %w", err)
	}

	session := &Session{
		id:        sessionID,
		command:   prepared.command,
		startedAt: time.Now(),
		running:   true,
		cancel:    cancel,
		stdin:     stdinPipe,
		cleanup: func() {
			_ = os.RemoveAll(prepared.runDir)
		},
		history: []TerminalEvent{
			{
				Type:    "start",
				Command: &prepared.command,
			},
		},
		subscribers: make(map[chan TerminalEvent]struct{}),
	}

	if err := cmd.Start(); err != nil {
		cancel()
		_ = stdinPipe.Close()
		session.cleanup()
		return nil, fmt.Errorf("start python process: %w", err)
	}

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	go m.streamPipe(session, stdoutPipe, "stdout")
	go m.streamPipe(session, stderrPipe, "stderr")
	go m.waitProcess(session, cmd, ctx)

	return session, nil
}

func (m *SessionManager) Get(sessionID string) (*Session, error) {
	m.mu.RLock()
	session, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return nil, ErrSessionNotFound
	}
	return session, nil
}

func (m *SessionManager) Remove(sessionID string) {
	m.mu.Lock()
	delete(m.sessions, sessionID)
	m.mu.Unlock()
}

func (m *SessionManager) streamPipe(session *Session, pipe io.ReadCloser, eventType string) {
	defer pipe.Close()

	buffer := make([]byte, 2048)
	for {
		n, err := pipe.Read(buffer)
		if n > 0 {
			session.broadcast(TerminalEvent{
				Type: eventType,
				Data: string(buffer[:n]),
			})
		}

		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			session.broadcast(TerminalEvent{
				Type:    "error",
				Message: err.Error(),
			})
			return
		}
	}
}

func (m *SessionManager) waitProcess(session *Session, cmd *exec.Cmd, ctx context.Context) {
	startedAt := session.startedAt
	waitErr := cmd.Wait()
	durationMs := time.Since(startedAt).Milliseconds()

	timedOut := ctx.Err() == context.DeadlineExceeded
	exitCode := 0

	if waitErr != nil {
		var exitErr *exec.ExitError
		if errors.As(waitErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		} else if timedOut {
			exitCode = -1
		} else {
			exitCode = -1
			session.broadcast(TerminalEvent{
				Type:    "error",
				Message: waitErr.Error(),
			})
		}
	}

	session.finish(exitCode, timedOut, durationMs)
	time.AfterFunc(10*time.Minute, func() {
		m.Remove(session.id)
	})
}

func (s *Session) Summary() SessionSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return SessionSummary{
		ID:        s.id,
		Command:   s.command,
		Running:   s.running,
		StartedAt: s.startedAt,
	}
}

func (s *Session) History() []TerminalEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	history := make([]TerminalEvent, len(s.history))
	copy(history, s.history)
	return history
}

func (s *Session) Subscribe() (chan TerminalEvent, func()) {
	ch := make(chan TerminalEvent, 256)

	s.mu.Lock()
	s.subscribers[ch] = struct{}{}
	s.mu.Unlock()

	unsubscribe := func() {
		s.mu.Lock()
		if _, ok := s.subscribers[ch]; ok {
			delete(s.subscribers, ch)
			close(ch)
		}
		s.mu.Unlock()
	}

	return ch, unsubscribe
}

func (s *Session) WriteInput(data string) error {
	s.mu.RLock()
	running := s.running
	stdin := s.stdin
	s.mu.RUnlock()

	if !running {
		return ErrSessionNotRunning
	}

	if _, err := io.WriteString(stdin, data); err != nil {
		return fmt.Errorf("write stdin: %w", err)
	}
	return nil
}

func (s *Session) Stop() error {
	s.mu.RLock()
	running := s.running
	cancel := s.cancel
	s.mu.RUnlock()

	if !running {
		return ErrSessionNotRunning
	}

	cancel()
	return nil
}

func (s *Session) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

func (s *Session) finish(exitCode int, timedOut bool, durationMs int64) {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}

	s.running = false
	if s.stdin != nil {
		_ = s.stdin.Close()
	}

	event := TerminalEvent{
		Type:       "exit",
		ExitCode:   &exitCode,
		DurationMs: durationMs,
		TimedOut:   timedOut,
	}

	s.history = append(s.history, event)
	subscribers := make([]chan TerminalEvent, 0, len(s.subscribers))
	for subscriber := range s.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	s.mu.Unlock()

	for _, subscriber := range subscribers {
		select {
		case subscriber <- event:
		default:
		}
	}

	if s.cleanup != nil {
		s.cleanup()
	}
}

func (s *Session) broadcast(event TerminalEvent) {
	s.mu.Lock()
	s.history = append(s.history, event)
	subscribers := make([]chan TerminalEvent, 0, len(s.subscribers))
	for subscriber := range s.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	s.mu.Unlock()

	for _, subscriber := range subscribers {
		select {
		case subscriber <- event:
		default:
		}
	}
}

func randomID() (string, error) {
	buffer := make([]byte, 12)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}
