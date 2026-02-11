"""Text-to-Speech REST endpoint.

When a deaf user taps a quick-reply button, the frontend sends the
spoken_text to this endpoint and receives back an MP3 audio stream
to play through the phone speaker.
"""

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse

from app.models.schemas import TTSRequest
from app.services.elevenlabs_tts import text_to_speech_bytes, text_to_speech_stream

router = APIRouter()


@router.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech and return audio.

    Request body: { "text": "Could you tell me how serious this is?", "voice_id": null }
    Response: MP3 audio bytes
    """
    audio_bytes = await text_to_speech_bytes(
        text=request.text,
        voice_id=request.voice_id,
    )

    # No audio (e.g. ElevenLabs quota exceeded): return empty so frontend uses browser TTS
    if not audio_bytes:
        return Response(
            status_code=200,
            content=b"",
            media_type="audio/mpeg",
            headers={"X-TTS-Fallback": "browser", "Cache-Control": "no-cache"},
        )

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-cache",
        },
    )


@router.post("/api/tts/stream")
async def text_to_speech_streaming(request: TTSRequest):
    """
    Convert text to speech and return audio as a stream.
    Lower time-to-first-byte than the batch endpoint.
    """
    return StreamingResponse(
        text_to_speech_stream(text=request.text, voice_id=request.voice_id),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-cache",
        },
    )
