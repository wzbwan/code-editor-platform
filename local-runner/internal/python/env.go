package python

import "os"

func pythonProcessEnv() []string {
	return append(os.Environ(),
		"PYTHONUTF8=1",
		"PYTHONIOENCODING=utf-8",
	)
}
