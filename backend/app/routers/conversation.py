"""Conversation Intelligence WebSocket.

Flow:
1. Frontend sends audio chunk (base64 encoded) every 3 seconds
2. Backend transcribes with Groq Whisper
3. Backend analyzes tone with Hume AI (or AFINN fallback)
4. Backend processes transcript through Claude for simplification + quick-replies
5. Backend sends results back to frontend

Frontend message format:
    { "type": "audio_chunk", "audio": "<base64>", "format": "webm" }  # format: webm|mp4|m4a for phone
    { "type": "start_listening" }
    { "type": "stop_listening" }
    { "type": "set_profile", "profile_type": "deaf" | "blind" }

Backend response format:
    { "type": "transcript", "text": "...", "tone": "carefully", "tone_category": "neutral" }
    { "type": "simplified", "text": "...", "quick_replies": [...] }
    { "type": "summary", "text": "..." }  // for blind profile
    { "type": "status", "message": "listening" | "processing" | "idle" }
    { "type": "error", "message": "..." }
"""

import asyncio
import base64
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.services.afinn_fallback import analyze_text_sentiment
from app.services.claude_intelligence import process_transcript
from app.services.groq_stt import get_filename_for_format, transcribe_audio
from app.services.hume_tone import analyze_tone_from_audio
from app.services.tone_mapper import get_tone_category

router = APIRouter()


@router.websocket("/ws/conversation")
async def conversation_ws(websocket: WebSocket):
    await websocket.accept()
    print(f"Conversation WS: client connected ({websocket.client})")

    profile_type = "deaf"
    conversation_history = ""
    is_listening = False

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type", "")

            if msg_type == "set_profile":
                profile_type = message.get("profile_type", "deaf")
                await websocket.send_json({"type": "status", "message": f"profile_set:{profile_type}"})
                continue

            if msg_type == "start_listening":
                is_listening = True
                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            if msg_type == "stop_listening":
                is_listening = False
                await websocket.send_json({"type": "status", "message": "idle"})
                continue

            if msg_type != "audio_chunk" or not is_listening:
                continue

            print(f"🎤 Audio chunk received!")

            # Log to file for debugging
            with open("/tmp/senseai_debug.log", "a") as f:
                import datetime
                f.write(f"\n[{datetime.datetime.now()}] Audio chunk received\n")

            await websocket.send_json({"type": "status", "message": "processing"})

            audio_b64 = message.get("audio", "")
            audio_format = message.get("format", "webm")
            print(f"   Format: {audio_format}, Base64 length: {len(audio_b64)}")

            try:
                audio_bytes = base64.b64decode(audio_b64)
                print(f"   Decoded audio bytes: {len(audio_bytes)}")
            except Exception as e:
                print(f"❌ Audio decode error: {e}")
                await websocket.send_json({"type": "error", "message": f"Audio decode error: {e}"})
                continue

            # Phone compatibility: optional chunk size cap
            if len(audio_bytes) < 1000:
                print(f"⚠️  Audio too short: {len(audio_bytes)} bytes, skipping")
                continue
            if settings.MOBILE_MODE and len(audio_bytes) > settings.MAX_AUDIO_CHUNK_BYTES:
                audio_bytes = audio_bytes[: settings.MAX_AUDIO_CHUNK_BYTES]

            filename = get_filename_for_format(audio_format)

            # Step 1 + 2: Transcribe and analyze tone IN PARALLEL
            print(f"🎙️  Starting transcription and tone analysis...")
            transcript_task = asyncio.create_task(
                transcribe_audio(audio_bytes, filename=filename)
            )
            tone_task = asyncio.create_task(analyze_tone_from_audio(audio_bytes))

            transcript_result, tone_result = await asyncio.gather(
                transcript_task, tone_task, return_exceptions=True
            )

            if isinstance(transcript_result, Exception):
                print(f"❌ Transcription exception: {transcript_result}")
                transcript_result = {"success": False, "text": "", "error": str(transcript_result)}
            if isinstance(tone_result, Exception):
                print(f"❌ Tone analysis exception: {tone_result}")
                tone_result = {"success": False, "primary_tone": "neutral", "confidence": 0.0}

            print(f"🎭 Tone result: {tone_result}")

            transcript_text = transcript_result.get("text", "").strip()
            print(f"📝 Transcript: '{transcript_text}'")

            if not transcript_text:
                print(f"⚠️  Empty transcript, skipping")
                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            # Use Hume tone or AFINN fallback
            if tone_result.get("success"):
                tone_label = tone_result.get("primary_tone", "speaking")
                tone_category = get_tone_category(tone_label)
                top_emotions = tone_result.get("top_emotions", [])
                tone_confidence = tone_result.get("confidence", 0.0)
                print(f"🎭 Hume tone: {tone_label} ({tone_category})")
            else:
                print(f"⚠️  Hume failed, using AFINN fallback")
                fallback = analyze_text_sentiment(transcript_text)
                tone_label = fallback.get("primary_tone", "speaking")
                tone_category = fallback.get("tone_category", "neutral")
                top_emotions = []
                tone_confidence = fallback.get("confidence", 0.5)
                print(f"🎭 AFINN tone: {tone_label} ({tone_category})")

            await websocket.send_json({
                "type": "transcript",
                "text": transcript_text,
                "tone": tone_label,
                "tone_category": tone_category,
                "tone_confidence": tone_confidence,
                "top_emotions": top_emotions,
            })

            conversation_history += f"\n[{tone_label}]: {transcript_text}"
            if len(conversation_history) > 2000:
                conversation_history = conversation_history[-1500:]

            claude_result = await process_transcript(
                transcript=transcript_text,
                tone_label=tone_label,
                conversation_context=conversation_history,
                profile_type=profile_type,
            )

            await websocket.send_json({
                "type": "simplified",
                "text": claude_result.get("simplified", transcript_text),
                "quick_replies": claude_result.get("quick_replies", []),
            })

            if profile_type == "blind":
                summary = claude_result.get("summary", transcript_text)
                await websocket.send_json({
                    "type": "summary",
                    "text": f"The speaker said {tone_label}: {summary}",
                })

            await websocket.send_json({"type": "status", "message": "listening"})

    except WebSocketDisconnect:
        print(f"Conversation WS: client disconnected ({websocket.client})")
    except Exception as e:
        print(f"Conversation WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
