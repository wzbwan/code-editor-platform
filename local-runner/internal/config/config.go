package config

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type PythonCommand struct {
	Name string
	Args []string
}

type Config struct {
	Host           string
	Port           int
	AllowedOrigins []string
	SharedToken    string
	MaxRunSeconds  int
	WorkDir        string
	Python         []PythonCommand
}

func Load() (Config, error) {
	port, err := getInt("RUNNER_PORT", 18423)
	if err != nil {
		return Config{}, err
	}

	maxRunSeconds, err := getInt("RUNNER_MAX_RUN_SECONDS", 10)
	if err != nil {
		return Config{}, err
	}

	workDir := os.Getenv("RUNNER_WORKDIR")
	if workDir == "" {
		workDir = filepath.Join(".", "runner-data")
	}

	cfg := Config{
		Host:           "127.0.0.1",
		Port:           port,
		AllowedOrigins: parseCSV(os.Getenv("RUNNER_ALLOWED_ORIGINS")),
		SharedToken:    strings.TrimSpace(os.Getenv("RUNNER_SHARED_TOKEN")),
		MaxRunSeconds:  maxRunSeconds,
		WorkDir:        workDir,
		Python:         detectPythonCandidates(),
	}

	return cfg, nil
}

func (c Config) ListenAddress() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func getInt(key string, fallback int) (int, error) {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback, nil
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer: %w", key, err)
	}

	return value, nil
}

func parseCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		values = append(values, item)
	}
	return values
}

func detectPythonCandidates() []PythonCommand {
	explicitName := strings.TrimSpace(os.Getenv("RUNNER_PYTHON_COMMAND"))
	explicitArgs := strings.Fields(strings.TrimSpace(os.Getenv("RUNNER_PYTHON_ARGS")))
	if explicitName != "" {
		return []PythonCommand{
			{
				Name: explicitName,
				Args: explicitArgs,
			},
		}
	}

	if runtime.GOOS == "windows" {
		return []PythonCommand{
			{Name: "py", Args: []string{"-3"}},
			{Name: "python"},
			{Name: "python3"},
		}
	}

	return []PythonCommand{
		{Name: "python3"},
		{Name: "python"},
	}
}
