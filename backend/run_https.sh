#!/usr/bin/env bash
# Run backend over HTTPS/WSS so the SenseAI frontend (HTTPS) can connect without mixed-content errors.
# Uses the same mkcert certs as senseai-frontend (generate there: mkcert localhost 127.0.0.1 ::1).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../senseai-frontend" 2>/dev/null && pwd)"
KEY="${FRONTEND_DIR}/localhost+3-key.pem"
CERT="${FRONTEND_DIR}/localhost+3.pem"

if [[ ! -f "$KEY" || ! -f "$CERT" ]]; then
  echo "SSL certs not found. From senseai-frontend run:"
  echo "  mkcert localhost 127.0.0.1 ::1"
  echo "Then run this script again."
  exit 1
fi

cd "$SCRIPT_DIR"
echo "Starting backend with HTTPS (key/cert from senseai-frontend)..."
exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
  --ssl-keyfile "$KEY" --ssl-certfile "$CERT"
