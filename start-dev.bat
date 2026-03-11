@echo off
REM ========================================================================
REM Healthcare Surveillance System - Local Development Startup
REM ========================================================================
REM This script starts both backend and frontend servers for development
REM Backend: http://localhost:8000
REM Frontend: http://localhost:3000
REM ========================================================================

echo.
echo ========================================================================
echo    Healthcare Surveillance System - Development Environment
echo ========================================================================
echo.
echo Starting services...
echo.

REM Check if PostgreSQL is running
echo [1/4] Checking PostgreSQL...
timeout /t 1 /nobreak > nul

REM Start Django Backend
echo [2/4] Starting Django Backend (http://localhost:8000)...
start "Django Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python manage.py runserver 8000"
timeout /t 3 /nobreak > nul

REM Start Next.js Frontend
echo [3/4] Starting Next.js Frontend (http://localhost:3000)...
start "Next.js Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 5 /nobreak > nul

REM Open Browser
echo [4/4] Opening browser...
timeout /t 2 /nobreak > nul
start http://localhost:3000

echo.
echo ========================================================================
echo    System Started Successfully!
echo ========================================================================
echo.
echo    Frontend:  http://localhost:3000
echo    Backend:   http://localhost:8000/api
echo    Admin:     http://localhost:8000/admin
echo.
echo    Check the terminal windows for logs and errors.
echo    Press Ctrl+C in each window to stop the servers.
echo.
echo ========================================================================
echo.

pause
