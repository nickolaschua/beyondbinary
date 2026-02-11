#!/usr/bin/env bash
# Run backend over HTTPS/WSS so the SenseAI frontend (HTTPS) can connect without mixed-content errors.
# Uses the same mkcert certs as senseai-frontend (generate there: mkcert localhost 127.0.0.1 ::1).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../senseai-frontend" 2>/dev/null && pwd)"

find_pair_in_dir() {
  local dir="$1"
  local key=""
  local cert=""
  local base=""

  for base in localhost+4 localhost+3 localhost+2; do
    key="$dir/${base}-key.pem"
    cert="$dir/${base}.pem"
    if [[ -f "$key" && -f "$cert" ]]; then
      echo "$key|$cert"
      return 0
    fi
  done

  key="$(ls -1 "$dir"/localhost+*-key.pem 2>/dev/null | sort -V | tail -n1 || true)"
  if [[ -n "$key" ]]; then
    cert="${key%-key.pem}.pem"
    if [[ -f "$cert" ]]; then
      echo "$key|$cert"
      return 0
    fi
  fi

  return 1
}

PAIR="$(find_pair_in_dir "$FRONTEND_DIR" || true)"
if [[ -z "$PAIR" ]]; then
  PAIR="$(find_pair_in_dir "$SCRIPT_DIR" || true)"
fi

if [[ -z "$PAIR" ]]; then
  echo "SSL certs not found."
  echo "Generate trusted local certs in senseai-frontend:"
  echo "  cd ../senseai-frontend"
  echo "  mkcert localhost 127.0.0.1 ::1"
  echo "For LAN/device testing, include your IP:"
  echo "  mkcert localhost 127.0.0.1 ::1 YOUR_LAN_IP"
  echo "Then run this script again."
  exit 1
fi

KEY="${PAIR%%|*}"
CERT="${PAIR##*|}"
PYTHON_BIN="${PYTHON_BIN:-}"

if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$SCRIPT_DIR/venv/bin/python" ]]; then
    PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  else
    echo "Python not found. Activate your venv or install python3."
    exit 1
  fi
fi

cd "$SCRIPT_DIR"
echo "Starting backend with HTTPS..."
echo "Using cert: $CERT"
if ! "$PYTHON_BIN" -c "import uvicorn" >/dev/null 2>&1; then
  echo "uvicorn is not installed in the selected Python environment: $PYTHON_BIN"
  echo "Install backend deps first, e.g.:"
  echo "  $PYTHON_BIN -m pip install -r requirements.txt"
  exit 1
fi
exec "$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
  --ssl-keyfile "$KEY" --ssl-certfile "$CERT"
