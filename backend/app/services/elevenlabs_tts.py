"""ElevenLabs Text-to-Speech Service.

Converts text into natural-sounding speech using ElevenLabs' API.
Supports both batch (full audio file) and streaming modes.

For the hackathon, we use the HTTP streaming endpoint which returns
audio chunks as they're generated — this gives low time-to-first-byte.

Key voice settings:
- stability: 0.5 (balanced between consistent and expressive)
- similarity_boost: 0.8 (stay close to the voice's natural sound)
- style: 0.0 (neutral style)

Character budget: Free tier = 10,000 chars/month. Be conservative in testing.
"""

from elevenlabs.client import ElevenLabs

from app.config import settings

_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)
DEFAULT_VOICE_ID = settings.ELEVENLABS_VOICE_ID
DEFAULT_MODEL = "eleven_multilingual_v2"


async def text_to_speech_bytes(
    text: str,
    voice_id: str = None,
) -> bytes:
    """
    Convert text to speech and return full audio as bytes.

    Args:
        text: Text to speak
        voice_id: ElevenLabs voice ID (uses default if None)

    Returns:
        bytes: MP3 audio data
    """
    try:
        audio = _client.text_to_speech.convert(
            text=text,
            voice_id=voice_id or DEFAULT_VOICE_ID,
            model_id=DEFAULT_MODEL,
            output_format="mp3_22050_32",
            voice_settings={
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        )

        audio_bytes = b""
        for chunk in audio:
            if isinstance(chunk, bytes):
                audio_bytes += chunk

        return audio_bytes

    except Exception as e:
        err_str = str(e).lower()
        if "quota" in err_str or "credits" in err_str:
            print("ElevenLabs quota exceeded; frontend will use browser TTS.")
        else:
            print(f"ElevenLabs TTS error: {e}")
        return b""


def text_to_speech_stream(
    text: str,
    voice_id: str = None,
):
    """
    Convert text to speech and return a generator of audio chunks.
    Use this for streaming responses to the frontend.

    Yields:
        bytes: Chunks of MP3 audio data
    """
    try:
        audio_stream = _client.text_to_speech.stream(
            text=text,
            voice_id=voice_id or DEFAULT_VOICE_ID,
            model_id=DEFAULT_MODEL,
            output_format="mp3_22050_32",
            voice_settings={
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        )

        for chunk in audio_stream:
            if isinstance(chunk, bytes):
                yield chunk

    except Exception as e:
        err_str = str(e).lower()
        if "quota" in err_str or "credits" in err_str:
            print("ElevenLabs quota exceeded (stream); frontend will use browser TTS.")
        else:
            print(f"ElevenLabs TTS stream error: {e}")
        return
