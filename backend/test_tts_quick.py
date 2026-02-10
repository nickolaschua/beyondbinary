"""Quick TTS check: verify ElevenLabs streaming works (config + permissions).

Requires: pip install elevenlabs
Run from backend dir:  cd backend && python test_tts_quick.py
"""

import os
import sys
from pathlib import Path

# Load .env from backend dir
_env = Path(__file__).resolve().parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k.strip(), v)

API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") or "21m00Tcm4TlvDq8ikWAM"


def main():
    if not API_KEY:
        print("FAIL: ELEVENLABS_API_KEY is not set in .env")
        sys.exit(1)
    print("ELEVENLABS_API_KEY: set")
    print(f"ELEVENLABS_VOICE_ID: {VOICE_ID}")

    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=API_KEY)
        audio_stream = client.text_to_speech.stream(
            text="Hello",
            voice_id=VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_22050_32",
            voice_settings={"stability": 0.5, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True},
        )
        chunks = [c for c in audio_stream if isinstance(c, bytes)]
        if not chunks:
            print("FAIL: TTS returned no audio chunks")
            sys.exit(1)
        total = sum(len(c) for c in chunks)
        print(f"OK: TTS streaming works — {len(chunks)} chunk(s), {total} bytes total")
    except ImportError as e:
        print(f"FAIL: Install elevenlabs: pip install elevenlabs — {e}")
        sys.exit(1)
    except Exception as e:
        print(f"FAIL: TTS error — {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
