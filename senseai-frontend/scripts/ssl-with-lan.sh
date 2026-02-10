#!/usr/bin/env bash
# Generate SSL cert that includes your LAN IP so https://YOUR_IP:3000 works without cert errors.
# Run from senseai-frontend: ./scripts/ssl-with-lan.sh  (or npm run ssl:lan)

set -e
cd "$(dirname "$0")/.."
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
if [[ -z "$IP" ]]; then
  echo "Could not detect LAN IP. Run manually: mkcert localhost 127.0.0.1 ::1 YOUR_IP"
  exit 1
fi
echo "Adding LAN IP $IP to certificate..."
# Remove old localhost+4 so mkcert creates fresh ones
rm -f localhost+4.pem localhost+4-key.pem
mkcert localhost 127.0.0.1 ::1 "$IP"
# mkcert with 4 names produces localhost+4.pem
if [[ -f localhost+4.pem ]]; then
  echo "Done. Restart 'npm run dev' and use https://$IP:3000"
else
  mv localhost+3.pem localhost+4.pem 2>/dev/null || true
  mv localhost+3-key.pem localhost+4-key.pem 2>/dev/null || true
  echo "Done. Restart 'npm run dev' and use https://$IP:3000"
fi
