@echo off
REM Starts the Shared Resources Planner. Double-click this file on Windows,
REM or run it from a Command Prompt / PowerShell window.

cd /d "%~dp0\.."

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Install it from https://nodejs.org/ ^(LTS version^) and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies ^(first run only^)...
  call npm install
)

echo Starting Shared Resources Planner...
call npm start

pause
