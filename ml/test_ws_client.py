"""
Python WebSocket test client for SenseAI sign detection server.

Captures webcam frames, encodes as base64 JPEG, sends to the
WebSocket server, and prints received predictions with latency.

Tests the full pipeline without needing the browser frontend.

Usage:
    1. Start the server:  uvicorn ws_server:app --port 8001
    2. Run this client:   python test_ws_client.py

Press 'q' to quit.
"""

import asyncio
import base64
import json
import time

import cv2
import websockets


SERVER_URL = "ws://localhost:8001/ws/sign-detection"
JPEG_QUALITY = 70
TARGET_FPS = 10
FRAME_INTERVAL = 1.0 / TARGET_FPS


async def run_client():
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    if not cap.isOpened():
        print("ERROR: Cannot open webcam")
        return

    print(f"Connecting to {SERVER_URL}...")

    try:
        async with websockets.connect(SERVER_URL) as ws:
            print("Connected! Streaming frames. Press 'q' to quit.\n")
            frames_sent = 0
            total_latency = 0.0

            while True:
                loop_start = time.time()

                ret, frame = cap.read()
                if not ret:
                    print("Failed to read frame")
                    break

                # Encode as JPEG
                encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                _, buffer = cv2.imencode(".jpg", frame, encode_params)
                b64_frame = base64.b64encode(buffer).decode("utf-8")

                # Send frame
                send_time = time.time()
                msg = json.dumps({"type": "frame", "frame": b64_frame})
                await ws.send(msg)
                frames_sent += 1

                # Receive response
                response = await ws.recv()
                recv_time = time.time()
                latency_ms = (recv_time - send_time) * 1000
                total_latency += latency_ms

                data = json.loads(response)
                msg_type = data.get("type", "unknown")

                if msg_type == "buffering":
                    collected = data["frames_collected"]
                    needed = data["frames_needed"]
                    hands = data.get("hands_detected", False)
                    print(f"  Buffering: {collected}/{needed} frames | Hands: {'yes' if hands else 'no'} | {latency_ms:.0f}ms", end="\r")

                elif msg_type == "sign_prediction":
                    sign = data["sign"]
                    conf = data["confidence"]
                    stable = data["is_stable"]
                    new = data["is_new_sign"]
                    hands = data.get("hands_detected", False)
                    fps_count = data.get("frames_processed", 0)

                    status = ""
                    if new:
                        status = " ** NEW SIGN **"
                    elif stable:
                        status = " (stable)"

                    print(f"  [{frames_sent:>5}] {sign:<12} conf={conf:.2f} stable={stable} hands={'yes' if hands else 'no':>3} latency={latency_ms:.0f}ms{status}")

                elif msg_type == "error":
                    print(f"  ERROR: {data.get('message', 'unknown')}")

                # Show frame locally
                cv2.imshow("Test Client - Sending Frames", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

                # Throttle to target FPS
                elapsed = time.time() - loop_start
                sleep_time = FRAME_INTERVAL - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)

            # Summary
            avg_latency = total_latency / frames_sent if frames_sent > 0 else 0
            print(f"\n--- Session Summary ---")
            print(f"Frames sent: {frames_sent}")
            print(f"Average latency: {avg_latency:.1f}ms")

    except ConnectionRefusedError:
        print(f"ERROR: Cannot connect to {SERVER_URL}")
        print("Make sure the server is running: uvicorn ws_server:app --port 8001")
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed: {e}")
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    asyncio.run(run_client())
