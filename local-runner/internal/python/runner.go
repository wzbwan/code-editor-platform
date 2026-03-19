package python

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"local-runner/internal/config"
)

var ErrPythonNotFound = errors.New("python not found")
var ErrCodeRequired = errors.New("code is required")

type ResolvedCommand struct {
	Name    string   `json:"name"`
	Args    []string `json:"args"`
	Version string   `json:"version"`
}

type ExecutionRequest struct {
	Code           string `json:"code"`
	Stdin          string `json:"stdin"`
	TimeoutSeconds int    `json:"timeoutSeconds"`
	Filename       string `json:"filename"`
}

type ExecutionResult struct {
	Command    ResolvedCommand `json:"command"`
	Stdout     string          `json:"stdout"`
	Stderr     string          `json:"stderr"`
	ExitCode   int             `json:"exitCode"`
	DurationMs int64           `json:"durationMs"`
	TimedOut   bool            `json:"timedOut"`
}

type Runner struct {
	commands      []config.PythonCommand
	maxRunSeconds int
	workDir       string
	resolved      *ResolvedCommand
}

type preparedExecution struct {
	command        ResolvedCommand
	runDir         string
	filename       string
	timeoutSeconds int
}

func NewRunner(commands []config.PythonCommand, maxRunSeconds int, workDir string) *Runner {
	return &Runner{
		commands:      commands,
		maxRunSeconds: maxRunSeconds,
		workDir:       workDir,
	}
}

func (r *Runner) Resolve() (*ResolvedCommand, error) {
	if r.resolved != nil {
		return r.resolved, nil
	}

	for _, candidate := range r.commands {
		cmd := exec.Command(candidate.Name, append(candidate.Args, "--version")...)
		output, err := cmd.CombinedOutput()
		if err != nil {
			continue
		}

		r.resolved = &ResolvedCommand{
			Name:    candidate.Name,
			Args:    append([]string{}, candidate.Args...),
			Version: strings.TrimSpace(string(output)),
		}
		return r.resolved, nil
	}

	return nil, ErrPythonNotFound
}

func (r *Runner) prepareExecution(request ExecutionRequest) (preparedExecution, error) {
	resolved, err := r.Resolve()
	if err != nil {
		return preparedExecution{}, err
	}

	if strings.TrimSpace(request.Code) == "" {
		return preparedExecution{}, ErrCodeRequired
	}

	timeoutSeconds := request.TimeoutSeconds
	if timeoutSeconds <= 0 || timeoutSeconds > r.maxRunSeconds {
		timeoutSeconds = r.maxRunSeconds
	}

	if err := os.MkdirAll(r.workDir, 0o755); err != nil {
		return preparedExecution{}, fmt.Errorf("create workdir: %w", err)
	}

	runDir, err := os.MkdirTemp(r.workDir, "run-*")
	if err != nil {
		return preparedExecution{}, fmt.Errorf("create temp run dir: %w", err)
	}

	filename := strings.TrimSpace(request.Filename)
	if filename == "" {
		filename = "main.py"
	}
	filename = filepath.Base(filename)
	if !strings.HasSuffix(strings.ToLower(filename), ".py") {
		filename = filename + ".py"
	}

	codePath := filepath.Join(runDir, filename)
	if err := os.WriteFile(codePath, []byte(request.Code), 0o644); err != nil {
		_ = os.RemoveAll(runDir)
		return preparedExecution{}, fmt.Errorf("write code file: %w", err)
	}

	return preparedExecution{
		command:        *resolved,
		runDir:         runDir,
		filename:       filename,
		timeoutSeconds: timeoutSeconds,
	}, nil
}

func (r *Runner) Run(request ExecutionRequest) (ExecutionResult, error) {
	prepared, err := r.prepareExecution(request)
	if err != nil {
		return ExecutionResult{}, err
	}
	defer os.RemoveAll(prepared.runDir)

	ctx, cancel := context.WithTimeout(
		context.Background(),
		time.Duration(prepared.timeoutSeconds)*time.Second,
	)
	defer cancel()

	commandArgs := append(append([]string{}, prepared.command.Args...), "-u", prepared.filename)
	cmd := exec.CommandContext(ctx, prepared.command.Name, commandArgs...)
	cmd.Dir = prepared.runDir
	cmd.Env = pythonProcessEnv()
	cmd.Stdin = strings.NewReader(request.Stdin)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	start := time.Now()
	runErr := cmd.Run()
	durationMs := time.Since(start).Milliseconds()

	result := ExecutionResult{
		Command:    prepared.command,
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		DurationMs: durationMs,
	}

	if ctx.Err() == context.DeadlineExceeded {
		result.TimedOut = true
		result.ExitCode = -1
		return result, nil
	}

	if runErr == nil {
		result.ExitCode = 0
		return result, nil
	}

	var exitErr *exec.ExitError
	if errors.As(runErr, &exitErr) {
		result.ExitCode = exitErr.ExitCode()
		return result, nil
	}

	return result, fmt.Errorf("run python: %w", runErr)
}
