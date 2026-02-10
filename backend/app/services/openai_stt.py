"""OpenAI Whisper Speech-to-Text Service.

Uses OpenAI's Whisper API for transcription. We send audio chunks and get back
text. Same interface as groq_stt for drop-in replacement.

Limitations:
- Max file size: 25 MB per request
- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Phone compatibility: webm (Chrome/Android), mp4/m4a (iOS MediaRecorder)
"""

import asyncio
import io
from openai import OpenAI

from app.config import settings

_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

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
    Transcribe audio bytes using OpenAI's Whisper API.

    Args:
        audio_bytes: Raw audio data (webm, wav, mp3, etc.)
        filename: Filename hint for format detection
        language: ISO-639-1 language code (optional; omit for auto-detect)
        prompt: Context hint to improve accuracy

    Returns:
        dict with keys: text, language, duration, segments (if verbose)
    """
    if not _client:
        return {
            "success": False,
            "text": "",
            "error": "OPENAI_API_KEY not set",
        }
    try:
        def _transcribe():
            file_like = io.BytesIO(audio_bytes)
            file_like.name = filename
            file_like.seek(0)
            return _client.audio.transcriptions.create(
                model="whisper-1",
                file=file_like,
                prompt=prompt[:1000] if prompt else None,
                response_format="verbose_json",
                language=language or None,
            )

        transcription = await asyncio.to_thread(_transcribe)

        text = (transcription.text or "").strip()
        duration = getattr(transcription, "duration", None)
        if not text and duration is not None:
            print(f"OpenAI Whisper: empty text for {len(audio_bytes)} bytes, duration={duration}s (silence or low volume?)")

        return {
            "success": True,
            "text": text or "",
            "language": getattr(transcription, "language", language),
            "duration": duration,
            "segments": getattr(transcription, "segments", []),
        }

    except Exception as e:
        print(f"OpenAI Whisper STT error: {e}")
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
