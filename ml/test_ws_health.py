"""
Quick health check for the SenseAI WebSocket server.

Usage:
    1. Start the server:  uvicorn ws_server:app --port 8001
    2. Run this script:   python test_ws_health.py
"""

import json
import sys

import requests

HEALTH_URL = "http://localhost:8001/health"


def main():
    try:
        r = requests.get(HEALTH_URL, timeout=5)
        r.raise_for_status()
        data = r.json()
        print(json.dumps(data, indent=2))

        # Validate expected fields
        if data.get("status") == "ok" and data.get("model_loaded"):
            print(f"\nServer healthy. {len(data.get('actions', []))} actions loaded.")
        else:
            print("\nWARNING: Server responded but model may not be loaded.")
            sys.exit(1)

    except requests.ConnectionError:
        print(f"ERROR: Cannot connect to {HEALTH_URL}")
        print("Make sure the server is running: uvicorn ws_server:app --port 8001")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
