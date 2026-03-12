@echo off
setlocal

set "RUNNER_PORT=18423"
set "RUNNER_ALLOWED_ORIGINS=https://python.zengbao.wang"
set "RUNNER_SHARED_TOKEN=code-editor-platform-python-zengbao-wang"
set "RUNNER_WORKDIR=%~dp0runner-data"

if not exist "%RUNNER_WORKDIR%" mkdir "%RUNNER_WORKDIR%"

echo Local runner is starting on http://127.0.0.1:%RUNNER_PORT%
echo Allowed origin: %RUNNER_ALLOWED_ORIGINS%
echo.

"%~dp0local-runner.exe"

echo.
echo Local runner stopped. Press any key to close this window.
pause >nul
