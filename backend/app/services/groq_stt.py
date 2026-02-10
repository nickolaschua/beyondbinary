"""Groq Whisper Speech-to-Text Service.

Groq hosts OpenAI's Whisper Large v3 Turbo with incredibly fast inference
(216x real-time). We send audio chunks and get back text transcriptions.

The API is batch-based (not streaming), so the frontend sends audio in
short chunks (2-5 seconds) for a near-real-time experience.

Limitations:
- Max file size: 25 MB per request
- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Rate limit: ~50 requests/second (generous for our use case)

Phone compatibility: Supports webm (Chrome/Android) and mp4/m4a (iOS MediaRecorder).
"""

import asyncio
from groq import Groq

from app.config import settings

# Initialize client once at module level
_client = Groq(api_key=settings.GROQ_API_KEY)

# Map frontend format to filename extension (phone compatibility: iOS sends mp4/m4a)
FORMAT_TO_EXT = {
    "webm": "webm",
    "mp4": "m4a",
    "m4a": "m4a",
    "ogg": "ogg",
    "mp3": "mp3",
    "wav": "wav",
}


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str = "en",
    prompt: str = "Medical consultation conversation between a doctor and patient.",
) -> dict:
    """
    Transcribe audio bytes using Groq's Whisper API.

    Args:
        audio_bytes: Raw audio data (webm, wav, mp3, etc.)
        filename: Filename hint for format detection
        language: ISO-639-1 language code
        prompt: Context hint to improve accuracy (e.g., domain-specific terms)

    Returns:
        dict with keys: text, language, duration, segments (if verbose)
    """
    try:
        # Groq uses sync API — run in thread to avoid blocking event loop
        def _transcribe():
            return _client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",
                prompt=prompt,
                response_format="verbose_json",
                language=language,
                temperature=0.0,
            )

        transcription = await asyncio.to_thread(_transcribe)

        return {
            "success": True,
            "text": transcription.text,
            "language": getattr(transcription, "language", language),
            "duration": getattr(transcription, "duration", None),
            "segments": getattr(transcription, "segments", []),
        }

    except Exception as e:
        print(f"Groq STT error: {e}")
        return {
            "success": False,
            "text": "",
            "error": str(e),
        }


async def transcribe_audio_simple(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Convenience wrapper that returns just the transcript text, or empty string on error."""
    result = await transcribe_audio(audio_bytes, filename)
    return result.get("text", "")


def get_filename_for_format(format_str: str) -> str:
    """Get filename extension for frontend format (phone compatibility)."""
    ext = FORMAT_TO_EXT.get((format_str or "webm").lower(), "webm")
    return f"chunk.{ext}"
