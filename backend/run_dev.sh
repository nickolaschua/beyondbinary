#!/bin/bash
# Development server that listens on all network interfaces
# This allows other devices on your network to connect

# Run from script's directory so uvicorn finds app.main
cd "$(dirname "$0")"

# Use venv if present (so uvicorn is available)
if [ -d "venv" ]; then
  source venv/bin/activate
elif [ -d ".venv" ]; then
  source .venv/bin/activate
fi

echo "🚀 Starting SenseAI Backend..."
echo "📡 Listening on all network interfaces (0.0.0.0:8000)"
echo ""
echo "Local access:    http://localhost:8000"
echo "Network access:  http://10.91.174.93:8000"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
