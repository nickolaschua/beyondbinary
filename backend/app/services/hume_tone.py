"""Hume AI Tone/Prosody Analysis Service.

Uses Hume's Expression Measurement streaming API to analyze the emotional
content of speech. Returns 48 dimensions of prosody that we map to
simplified labels for the frontend.

Hume stream API limit: 5000ms per request. We truncate to last 5s if longer.

When Hume is unavailable (API key missing, API change, etc.),
the conversation router falls back to AFINN text sentiment.
"""

import warnings
warnings.filterwarnings('ignore', message='.*Pydantic V1 functionality.*')

import tempfile
from pathlib import Path

from app.config import settings
from app.services.tone_mapper import map_prosody_to_label


async def analyze_tone_from_audio(audio_bytes: bytes) -> dict:
    """
    Analyze the emotional tone of an audio clip using Hume's prosody model.

    Args:
        audio_bytes: Raw audio data

    Returns:
        dict with:
            - primary_tone: str (e.g., "concerned", "calm", "excited")
            - confidence: float
            - top_emotions: list of {name, score} for top 5 emotions
            - raw_scores: full 48-dimension dict (for frontend visualization)
    """
    if not settings.HUME_API_KEY:
        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": "Hume API key not configured",
        }

    try:
        from hume import AsyncHumeClient
        from hume.expression_measurement.stream.stream.types import Config

        print(f"🎭 Hume: Initializing client...")

        # Log to file
        with open("/tmp/senseai_debug.log", "a") as f:
            import datetime
            f.write(f"[{datetime.datetime.now()}] Hume: Starting analysis\n")

        client = AsyncHumeClient(api_key=settings.HUME_API_KEY)

        # Use prosody model for voice emotion analysis
        # Note: Language model doesn't work with audio files, only text
        config = Config(prosody={})
        print(f"🎭 Hume: Client created with prosody config...")

        # Hume limit: 5000ms. ~16KB/s for webm/opus → 5s ≈ 80KB
        HUME_MAX_BYTES = 81_000
        if len(audio_bytes) > HUME_MAX_BYTES:
            audio_bytes = audio_bytes[-HUME_MAX_BYTES:]
            print(f"🎭 Hume: Truncated to last 5s ({len(audio_bytes)} bytes)")

        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        print(f"🎭 Hume: Audio saved to {temp_path} ({len(audio_bytes)} bytes)")

        try:
            # Hume 0.13.6 stream API: connect() takes no arguments
            print(f"🎭 Hume: Connecting to stream API...")
            async with client.expression_measurement.stream.connect() as socket:
                print(f"🎭 Hume: Connected! Sending audio file with prosody config...")
                result = await socket.send_file(temp_path, config=config)
                print(f"🎭 Hume: Got result: {type(result)}")

                # Check if result is an error message
                if hasattr(result, "error"):
                    print(f"❌ Hume API Error: {result.error}")
                    return {
                        "success": False,
                        "primary_tone": "neutral",
                        "confidence": 0.0,
                        "error": f"Hume API error: {result.error}",
                    }

                # Process prosody (voice tone) results
                prosody_emotions = None
                if result and hasattr(result, "prosody") and result.prosody:
                    print(f"🎭 Hume: Result has prosody data!")
                    predictions = getattr(result.prosody, "predictions", []) or []
                    print(f"🎭 Hume: {len(predictions)} prosody predictions found")
                    if predictions:
                        pred = predictions[0]
                        emotions = getattr(pred, "emotions", []) or []
                        print(f"🎭 Hume: {len(emotions)} emotions detected")
                        if emotions:
                            emotion_dict = {e.name: e.score for e in emotions}
                            sorted_emotions = sorted(
                                emotion_dict.items(), key=lambda x: x[1], reverse=True
                            )

                            # Improved accuracy: Use top 2-3 emotions instead of just #1
                            # If the top 2 emotions are close in score, choose the more contextually appropriate one
                            primary = sorted_emotions[0]
                            primary_name, primary_score = primary

                            # Check if there's a strong secondary emotion (within 0.1 of primary)
                            if len(sorted_emotions) >= 2:
                                secondary_name, secondary_score = sorted_emotions[1]
                                score_diff = primary_score - secondary_score

                                # If emotions are close, prefer more specific/actionable ones
                                if score_diff < 0.1:
                                    # Prefer specific emotions over generic ones
                                    generic_emotions = {"Calmness", "Concentration", "Contemplation"}
                                    if primary_name in generic_emotions and secondary_name not in generic_emotions:
                                        print(f"🎭 Switching from generic '{primary_name}' to more specific '{secondary_name}'")
                                        primary = sorted_emotions[1]
                                        primary_name, primary_score = primary

                            # Also check top 3 for nuance
                            if len(sorted_emotions) >= 3:
                                third_name, third_score = sorted_emotions[2]
                                # If top 3 are all similar scores, boost confidence in the pattern
                                if (primary_score - third_score) < 0.15:
                                    print(f"🎭 Top 3 emotions are similar: {primary_name}, {secondary_name}, {third_name}")

                            top_5 = [
                                {"name": name, "score": round(score, 3)}
                                for name, score in sorted_emotions[:5]
                            ]

                            prosody_emotions = {
                                "primary_name": primary_name,
                                "primary_score": primary_score,
                                "top_5": top_5,
                                "emotion_dict": emotion_dict,
                            }

                            print(f"✅ Hume SUCCESS! Primary emotion: {primary_name} ({primary_score:.3f})")
                            print(f"   Top 3: {', '.join([f'{n}({s:.2f})' for n, s in sorted_emotions[:3]])}")

                # Return prosody results with improved multi-emotion analysis
                if prosody_emotions:
                    return {
                        "success": True,
                        "primary_tone": map_prosody_to_label(prosody_emotions["primary_name"]),
                        "primary_raw": prosody_emotions["primary_name"],
                        "confidence": round(prosody_emotions["primary_score"], 3),
                        "top_emotions": prosody_emotions["top_5"],
                        "raw_scores": prosody_emotions["emotion_dict"],
                    }
                else:
                    print(f"⚠️ Hume: No prosody data in result")
        finally:
            Path(temp_path).unlink(missing_ok=True)

        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": "No prosody predictions returned",
        }

    except (ImportError, AttributeError, TypeError) as e:
        print(f"Hume API unavailable (use afinn fallback): {e}")
        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": str(e),
        }
    except Exception as e:
        print(f"Hume tone analysis error: {e}")
        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": str(e),
        }
