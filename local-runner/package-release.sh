#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
WINDOWS_DIR="$RELEASE_DIR/local-runner-windows-amd64"
LINUX_AMD64_DIR="$RELEASE_DIR/local-runner-linux-amd64"
LINUX_ARM64_DIR="$RELEASE_DIR/local-runner-linux-arm64"

if ! command -v go >/dev/null 2>&1; then
  echo "go is required but was not found in PATH" >&2
  exit 1
fi

rm -rf "$WINDOWS_DIR" "$LINUX_AMD64_DIR" "$LINUX_ARM64_DIR"
rm -f \
  "$RELEASE_DIR/local-runner-windows-amd64.zip" \
  "$RELEASE_DIR/local-runner-linux-amd64.tar.gz" \
  "$RELEASE_DIR/local-runner-linux-arm64.tar.gz"

mkdir -p "$WINDOWS_DIR" "$LINUX_AMD64_DIR" "$LINUX_ARM64_DIR"

echo "Building Windows amd64 binary..."
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
  go build -trimpath -ldflags="-s -w" \
  -o "$WINDOWS_DIR/local-runner.exe" \
  ./cmd/runner

echo "Building Linux amd64 binary..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
  go build -trimpath -ldflags="-s -w" \
  -o "$LINUX_AMD64_DIR/local-runner" \
  ./cmd/runner

echo "Building Linux arm64 binary..."
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 \
  go build -trimpath -ldflags="-s -w" \
  -o "$LINUX_ARM64_DIR/local-runner" \
  ./cmd/runner

chmod +x "$LINUX_AMD64_DIR/local-runner" "$LINUX_ARM64_DIR/local-runner"
chmod +x "$ROOT_DIR/packaging/start-local-runner.sh"

cp "$ROOT_DIR/packaging/start-local-runner.bat" "$WINDOWS_DIR/"
cp "$ROOT_DIR/packaging/README-student-windows.txt" "$WINDOWS_DIR/README-student.txt"
cp "$ROOT_DIR/packaging/start-local-runner.sh" "$LINUX_AMD64_DIR/"
cp "$ROOT_DIR/packaging/README-student-linux.md" "$LINUX_AMD64_DIR/README-student.md"
cp "$ROOT_DIR/packaging/start-local-runner.sh" "$LINUX_ARM64_DIR/"
cp "$ROOT_DIR/packaging/README-student-linux.md" "$LINUX_ARM64_DIR/README-student.md"

(
  cd "$RELEASE_DIR"
  zip -rq "local-runner-windows-amd64.zip" "local-runner-windows-amd64"
  tar -czf "local-runner-linux-amd64.tar.gz" "local-runner-linux-amd64"
  tar -czf "local-runner-linux-arm64.tar.gz" "local-runner-linux-arm64"
)

echo "Done."
echo "Windows package: $RELEASE_DIR/local-runner-windows-amd64.zip"
echo "Linux amd64:     $RELEASE_DIR/local-runner-linux-amd64.tar.gz"
echo "Linux arm64:     $RELEASE_DIR/local-runner-linux-arm64.tar.gz"
