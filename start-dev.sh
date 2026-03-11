#!/bin/bash

# ========================================================================
# Healthcare Surveillance System - Local Development Startup
# ========================================================================
# This script starts both backend and frontend servers for development
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
# ========================================================================

set -e  # Exit on error

echo ""
echo "========================================================================"
echo "   Healthcare Surveillance System - Development Environment"
echo "========================================================================"
echo ""
echo "Starting services..."
echo ""

# Get script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check PostgreSQL
echo "[1/4] Checking PostgreSQL..."
if command -v pg_isready > /dev/null 2>&1; then
    if ! pg_isready > /dev/null 2>&1; then
        echo "⚠️  PostgreSQL is not running. Please start it first."
        echo "   Linux: sudo systemctl start postgresql"
        echo "   Mac:   brew services start postgresql"
        exit 1
    fi
    echo "✅ PostgreSQL is running"
else
    echo "⚠️  pg_isready not found. Assuming PostgreSQL is running..."
fi

sleep 1

# Start Django Backend
echo ""
echo "[2/4] Starting Django Backend (http://localhost:8000)..."
cd "$DIR/backend"
source venv/bin/activate
python manage.py runserver 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

sleep 3

# Start Next.js Frontend
echo ""
echo "[3/4] Starting Next.js Frontend (http://localhost:3000)..."
cd "$DIR/frontend"
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

sleep 5

# Open Browser
echo ""
echo "[4/4] Opening browser..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000 &
elif command -v open > /dev/null; then
    open http://localhost:3000 &
fi

echo ""
echo "========================================================================"
echo "   System Started Successfully!"
echo "========================================================================"
echo ""
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8000/api"
echo "   Admin:     http://localhost:8000/admin"
echo ""
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "   Logs:"
echo "   - Backend:  tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "   Press Ctrl+C to stop all services"
echo ""
echo "========================================================================"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Wait for user to stop
wait
