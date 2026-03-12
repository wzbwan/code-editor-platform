#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

export RUNNER_PORT=18423
export RUNNER_ALLOWED_ORIGINS="https://python.zengbao.wang"
export RUNNER_SHARED_TOKEN="code-editor-platform-python-zengbao-wang"
export RUNNER_WORKDIR="$DIR/runner-data"

mkdir -p "$RUNNER_WORKDIR"

echo "Local runner is starting on http://127.0.0.1:${RUNNER_PORT}"
echo "Allowed origin: ${RUNNER_ALLOWED_ORIGINS}"
echo

exec "$DIR/local-runner"
