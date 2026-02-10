"""Conversation Intelligence WebSocket.

Flow:
1. Frontend sends audio chunk (base64 encoded) every 3 seconds
2. Backend transcribes with OpenAI Whisper
3. Backend analyzes tone with Hume AI (or AFINN fallback)
4. Backend processes transcript through Claude for simplification + quick-replies
5. Backend sends results back to frontend

Frontend message format:
    { "type": "audio_chunk", "audio": "<base64>", "format": "webm" }  # format: webm|mp4|m4a for phone
    { "type": "text_transcript", "text": "...", "is_final": true }  # Web Speech API (instant mode)
    { "type": "start_listening" }
    { "type": "stop_listening" }
    { "type": "set_profile", "profile_type": "deaf" | "blind" }
    { "type": "set_room", "room": "room_id" }
    { "type": "set_tts_preference", "value": true|false }  # recipient wants TTS for incoming chat
    { "type": "chat_message", "room": "room_id", "sender": "local"|"remote", "text": "...", "tts": true|false }
    { "type": "webrtc_offer", "target_peer_id": "...", "offer": {...} }
    { "type": "webrtc_answer", "target_peer_id": "...", "answer": {...} }
    { "type": "webrtc_ice_candidate", "target_peer_id": "...", "candidate": {...} }

Backend response format:
    { "type": "transcript", "text": "...", "tone": "analyzing...", "tone_category": "neutral" }  // Sent immediately (~500ms)
    { "type": "tone_update", "tone": "carefully", "tone_category": "neutral", "tone_confidence": 0.85, "top_emotions": [...] }  // Sent 1s later
    { "type": "simplified", "text": "...", "quick_replies": [...] }
    { "type": "summary", "text": "..." }  // for blind profile
    { "type": "status", "message": "listening" | "processing" | "idle" }
    { "type": "error", "message": "..." }
    { "type": "chat_message", "room": "...", "sender": "remote", "text": "...", "tts": true|false }
    { "type": "peer_joined", "peer_id": "..." }
    { "type": "peer_left", "peer_id": "..." }
    { "type": "webrtc_offer", "from_peer_id": "...", "offer": {...} }
    { "type": "webrtc_answer", "from_peer_id": "...", "answer": {...} }
    { "type": "webrtc_ice_candidate", "from_peer_id": "...", "candidate": {...} }
    { "type": "tts_audio_chunk", "audio_base64": "..." }
    { "type": "tts_audio_end" }
    { "type": "tts_error", "message": "..." }
"""

import asyncio
import base64
import json
import re
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.services.claude_intelligence import process_transcript
from app.services.openai_stt import get_filename_for_format as get_filename_for_format_openai
from app.services.openai_stt import transcribe_audio as transcribe_audio_openai
from app.services.groq_stt import get_filename_for_format as get_filename_for_format_groq
from app.services.groq_stt import transcribe_audio as transcribe_audio_groq
from app.services.hume_tone import analyze_tone_from_audio
from app.services.tone_mapper import get_tone_category
from app.services.prosody_buffer import ProsodyBuffer
from app.services.tone_aggregator import ToneAggregator, ToneSample
from app.services.elevenlabs_tts import text_to_speech_stream

router = APIRouter()

# In-memory room registry: room_id -> list of conn_info dicts.
# Each conn_info: {"ws": WebSocket, "profile_type": str, "wants_tts": bool, "client_id": str}
# Updated on set_profile, set_room, set_tts_preference.
_room_registry: dict[str, list[dict]] = {}


def _pick_stt_backend():
    """Select STT backend with fallback based on env + available API keys."""
    preferred = (settings.STT_PROVIDER or "groq").lower()

    if preferred == "groq" and settings.GROQ_API_KEY:
        return transcribe_audio_groq, get_filename_for_format_groq, "groq"
    if preferred == "openai" and settings.OPENAI_API_KEY:
        return transcribe_audio_openai, get_filename_for_format_openai, "openai"

    if settings.GROQ_API_KEY:
        return transcribe_audio_groq, get_filename_for_format_groq, "groq"
    return transcribe_audio_openai, get_filename_for_format_openai, "openai"


def _is_low_signal_transcript(text: str) -> bool:
    """Ignore punctuation-only / dot-noise transcripts and common Whisper hallucinations."""
    stripped = text.strip()
    if not stripped:
        return True
    if not re.search(r"[A-Za-z0-9]", stripped):
        return True
    # Filter out common Whisper hallucination phrases (case-insensitive)
    lower = stripped.lower()
    hallucinations = [
        "thank you",
        "thanks",
        "thank you.",
        "thanks.",
        "thank you for watching",
        "thanks for watching",
    ]
    if lower in hallucinations:
        return True
    return False


def _remove_conn_from_room(conn_info: dict, room_id: str | None) -> None:
    if not room_id or room_id not in _room_registry:
        return
    lst = _room_registry[room_id]
    for i, c in enumerate(lst):
        if c is conn_info:
            lst.pop(i)
            break
    if not lst:
        del _room_registry[room_id]


async def _stream_tts_to_ws(websocket: WebSocket, text: str) -> None:
    """Run ElevenLabs TTS stream and send chunks to one client. Non-blocking; catches errors."""
    try:
        # Run sync generator in thread to avoid blocking event loop
        loop = asyncio.get_event_loop()
        chunks = await loop.run_in_executor(
            None, lambda: list(text_to_speech_stream(text))
        )
        for chunk in chunks:
            if chunk:
                b64 = base64.b64encode(chunk).decode("ascii")
                await websocket.send_json({"type": "tts_audio_chunk", "audio_base64": b64})
        await websocket.send_json({"type": "tts_audio_end"})
    except Exception as e:
        print(f"TTS stream error: {e}")
        try:
            await websocket.send_json({"type": "tts_error", "message": "TTS unavailable"})
        except Exception:
            pass


@router.websocket("/ws/conversation")
async def conversation_ws(websocket: WebSocket):
    await websocket.accept()
    print(f"Conversation WS: client connected ({websocket.client})")

    # Per-connection state; conn_info is shared with room registry for profile_type and fan-out
    profile_type = "deaf"
    client_id = str(uuid.uuid4())
    conn_info: dict = {
        "ws": websocket,
        "profile_type": profile_type,
        "wants_tts": False,
        "client_id": client_id,
    }
    room_id: str | None = None
    conversation_history = ""
    is_listening = False
    last_utterance_id: str | None = None
    tone_aggregator = ToneAggregator()
    use_web_speech_for_utterances = False  # True once we receive text_transcript (hybrid mode)
    pending_utterances: list[dict] = []  # [{id, start, end, tone_confidence}, ...] for late tone updates
    PENDING_UTTERANCE_LIMIT = 10
    transcribe_audio, get_filename_for_format, stt_provider = _pick_stt_backend()
    print(f"🗣️ STT backend: {stt_provider}")

    async def on_tone_sample(tone_result: dict, start_time: float, end_time: float):
        """Store tone sample and emit late tone_update for overlapping pending utterances."""
        sample = ToneSample(
            start_time=start_time,
            end_time=end_time,
            emotion=tone_result.get("primary_tone", "neutral"),
            confidence=tone_result.get("confidence", 0.0),
        )
        tone_aggregator.add_sample(sample)

        # Emit tone_update for pending utterances that overlap and lacked confident tone
        tone_label = tone_result.get("primary_tone", "neutral")
        tone_conf = tone_result.get("confidence", 0.0)
        if tone_conf < 0.1:
            return

        updated_any = False
        for u in list(pending_utterances):
            if (u.get("tone_confidence") or 0) >= 0.3:
                continue
            u_start, u_end = u["start"], u["end"]
            overlap = min(u_end, end_time) - max(u_start, start_time)
            if overlap <= 0:
                continue
            aggregated = tone_aggregator.aggregate_for_utterance(
                u_start, u_end, min_overlap_ratio=0.05, min_confidence=0.1
            )
            if not aggregated or aggregated.get("confidence", 0) < 0.1:
                continue
            agg_label = aggregated["label"]
            agg_conf = aggregated["confidence"]
            try:
                await websocket.send_json({
                    "type": "tone_update",
                    "utterance_id": u["id"],
                    "tone": agg_label,
                    "tone_category": get_tone_category(agg_label),
                    "tone_confidence": agg_conf,
                    "top_emotions": [],
                })
            except Exception:
                return
            u["tone_confidence"] = agg_conf
            updated_any = True
            print(f"📤 Late tone_update: {u['id'][:8]}... → {agg_label}")

        # Fallback: if no overlap matched, update the most recent pending utterance
        if not updated_any and pending_utterances:
            for u in reversed(pending_utterances):
                if (u.get("tone_confidence") or 0) < 0.2:
                    try:
                        await websocket.send_json({
                            "type": "tone_update",
                            "utterance_id": u["id"],
                            "tone": tone_label,
                            "tone_category": get_tone_category(tone_label),
                            "tone_confidence": tone_conf,
                            "top_emotions": [],
                        })
                    except Exception:
                        return
                    u["tone_confidence"] = tone_conf
                    print(f"📤 Late tone_update (fallback): {u['id'][:8]}... → {tone_label}")
                    break

    prosody_buffer = ProsodyBuffer(
        window_size_seconds=2.5,        # More context for Hume prosody
        analysis_interval_seconds=0.8,   # Analyze every 0.8s
        tone_analyzer=analyze_tone_from_audio,
        on_tone_update=None,  # Tone emitted only via aggregation
        on_tone_sample=on_tone_sample,
    )

    await prosody_buffer.start()

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type", "")

            if msg_type == "set_profile":
                profile_type = message.get("profile_type", "deaf")
                conn_info["profile_type"] = profile_type
                await websocket.send_json({"type": "status", "message": f"profile_set:{profile_type}"})
                continue

            if msg_type == "set_room":
                new_room = (message.get("room") or "").strip()
                if not new_room:
                    continue
                _remove_conn_from_room(conn_info, room_id)
                room_id = new_room
                if room_id not in _room_registry:
                    _room_registry[room_id] = []

                # Get existing peers before adding this connection
                existing_peers = [p for p in _room_registry.get(room_id, []) if p["ws"] is not websocket]

                _room_registry[room_id].append(conn_info)
                await websocket.send_json({"type": "status", "message": f"room_set:{room_id}"})

                print(f"[WebRTC] {client_id} joined room {room_id}. Room now has {len(_room_registry[room_id])} peers.")

                # Notify this connection about existing peers
                for peer in existing_peers:
                    try:
                        print(f"[WebRTC] Notifying {client_id} about existing peer {peer['client_id']}")
                        await websocket.send_json({
                            "type": "peer_joined",
                            "peer_id": peer["client_id"],
                        })
                    except Exception as e:
                        print(f"[WebRTC] Error notifying about existing peer: {e}")
                        continue

                # Notify existing peers about this new connection
                for peer in existing_peers:
                    try:
                        print(f"[WebRTC] Notifying {peer['client_id']} about new peer {client_id}")
                        await peer["ws"].send_json({
                            "type": "peer_joined",
                            "peer_id": client_id,
                        })
                    except Exception as e:
                        print(f"[WebRTC] Error notifying peer: {e}")
                        continue
                continue

            if msg_type == "set_tts_preference":
                conn_info["wants_tts"] = bool(message.get("value", False))
                continue

            # WebRTC signaling fanout inside the same room (1:1 friendly, also works with target_peer_id).
            if msg_type in ("webrtc_offer", "webrtc_answer", "webrtc_ice_candidate"):
                if not room_id:
                    continue
                target_peer_id = (message.get("target_peer_id") or "").strip()
                peers = _room_registry.get(room_id, [])
                for peer in peers:
                    if peer["ws"] is websocket:
                        continue
                    if target_peer_id and peer.get("client_id") != target_peer_id:
                        continue
                    payload = {
                        "type": msg_type,
                        "from_peer_id": client_id,
                    }
                    if msg_type == "webrtc_offer":
                        payload["offer"] = message.get("offer")
                    elif msg_type == "webrtc_answer":
                        payload["answer"] = message.get("answer")
                    else:
                        payload["candidate"] = message.get("candidate")
                    try:
                        await peer["ws"].send_json(payload)
                    except Exception:
                        continue
                continue

            if msg_type == "chat_message":
                text = (message.get("text") or "").strip()
                sender = message.get("sender", "local")
                want_tts = message.get("tts", False)
                if not text or sender not in ("local", "remote"):
                    continue
                if not room_id:
                    continue
                # Append to this connection's conversation history
                conversation_history += f"\n[chat] {sender}: {text}"
                if len(conversation_history) > 2000:
                    conversation_history = conversation_history[-1500:]
                # Fan-out to other connections in the same room
                peers = _room_registry.get(room_id, [])
                for peer in peers:
                    if peer["ws"] is websocket:
                        continue
                    recv_profile = peer.get("profile_type", "deaf")
                    recv_wants_tts = peer.get("wants_tts", False)
                    tts_for_peer = want_tts or (recv_profile == "blind") or recv_wants_tts
                    try:
                        await peer["ws"].send_json({
                            "type": "chat_message",
                            "room": room_id,
                            "sender": "remote",
                            "text": text,
                            "tts": tts_for_peer,
                        })
                    except Exception:
                        continue
                    if tts_for_peer:
                        print(f"Chat TTS: streaming to peer (wants_tts={recv_wants_tts}, blind={recv_profile == 'blind'})")
                        asyncio.create_task(_stream_tts_to_ws(peer["ws"], text))
                continue

            if msg_type == "start_listening":
                is_listening = True
                if message.get("use_web_speech"):
                    use_web_speech_for_utterances = True
                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            if msg_type == "stop_listening":
                is_listening = False
                await websocket.send_json({"type": "status", "message": "idle"})
                continue

            # Handle Web Speech API text input (for instant captions mode)
            if msg_type == "text_transcript":
                use_web_speech_for_utterances = True
                if not is_listening:
                    continue

                transcript_text = message.get("text", "").strip()
                is_final = message.get("is_final", True)

                if not transcript_text:
                    continue

                print(f"💬 Web Speech transcript: '{transcript_text}' (final: {is_final})")

                utterance_id = str(uuid.uuid4()) if is_final else None
                if is_final:
                    last_utterance_id = utterance_id

                # Send transcript immediately (no audio processing needed!)
                transcript_payload = {
                    "type": "transcript",
                    "text": transcript_text,
                    "tone": "analyzing..." if is_final else "interim",
                    "tone_category": "neutral",
                    "tone_confidence": 0.0,
                    "top_emotions": [],
                    "source": "web_speech",
                    "is_final": is_final,
                }
                if utterance_id:
                    transcript_payload["utterance_id"] = utterance_id
                await websocket.send_json(transcript_payload)

                # Only process final transcripts for tone/quick-replies
                if is_final:
                    # Hume (audio) tone only - no AFINN. Use neutral when no samples yet; late tone_update will overwrite.
                    now = time.time()
                    utterance_end = now
                    utterance_start = now - 5.0  # 5s window for overlap with Hume samples
                    aggregated = tone_aggregator.aggregate_for_utterance(
                        utterance_start, utterance_end, min_overlap_ratio=0.1, min_confidence=0.1
                    )
                    if aggregated and aggregated.get("confidence", 0) >= 0.1:
                        tone_label = aggregated["label"]
                        tone_confidence = aggregated["confidence"]
                        tone_source = "audio"
                    else:
                        tone_label = "neutral"
                        tone_confidence = 0.0
                        tone_source = "audio"
                    tone_category = get_tone_category(tone_label)

                    # Track for late tone updates when Hume returns after we've emitted
                    pending_utterances.append({
                        "id": utterance_id,
                        "start": utterance_start,
                        "end": utterance_end,
                        "tone_confidence": tone_confidence,
                    })
                    if len(pending_utterances) > PENDING_UTTERANCE_LIMIT:
                        pending_utterances.pop(0)

                    # utterance_created (new contract)
                    await websocket.send_json({
                        "type": "utterance_created",
                        "utterance_id": utterance_id,
                        "start_time": utterance_start,
                        "end_time": utterance_end,
                        "text": transcript_text,
                        "tone": {"label": tone_label, "confidence": tone_confidence, "source": tone_source},
                        "is_final": True,
                    })

                    tone_payload = {
                        "type": "tone_update",
                        "tone": tone_label,
                        "tone_category": tone_category,
                        "tone_confidence": tone_confidence,
                        "top_emotions": [],
                    }
                    if utterance_id:
                        tone_payload["utterance_id"] = utterance_id
                    await websocket.send_json(tone_payload)

                    # Process for quick-replies
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

                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            if msg_type != "audio_chunk" or not is_listening:
                continue

            # In hybrid mode (Web Speech + audio), use audio only for tone - no Whisper/utterance
            if use_web_speech_for_utterances:
                audio_b64 = message.get("audio", "")
                try:
                    audio_bytes = base64.b64decode(audio_b64)
                except Exception:
                    continue
                if len(audio_bytes) >= 1000:
                    await prosody_buffer.append_chunk(audio_bytes)
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

            # =================================================================
            # DECOUPLED FLOW: Immediate subtitles + background tone analysis
            # =================================================================

            chunk_received_time = time.time()

            # Step 1: Add audio to sliding window buffer (non-blocking)
            # Background monitor loop continuously checks if analysis is needed
            await prosody_buffer.append_chunk(audio_bytes)

            # Step 2: Transcribe audio (FAST - don't wait for tone!)
            print(f"🎙️  Transcribing audio...")
            transcript_result = await transcribe_audio(
                audio_bytes,
                filename=filename,
                language="en",
                prompt="Live speech or conversation for real-time captioning.",
            )

            if isinstance(transcript_result, Exception):
                print(f"❌ Transcription exception: {transcript_result}")
                transcript_result = {"success": False, "text": "", "error": str(transcript_result)}

            transcript_text = transcript_result.get("text", "").strip()
            duration = transcript_result.get("duration")
            if duration is None:
                # Estimate: webm ~16KB/s
                duration = len(audio_bytes) / 16_000
            utterance_end = chunk_received_time
            utterance_start = chunk_received_time - duration
            print(f"📝 Transcript: '{transcript_text}'")

            if _is_low_signal_transcript(transcript_text):
                err = transcript_result.get("error")
                duration = transcript_result.get("duration")
                if err:
                    print(f"⚠️  Empty transcript (API error): {err}")
                elif transcript_text:
                    print(f"⚠️  Low-signal transcript skipped: '{transcript_text}'")
                elif duration is not None:
                    print(f"⚠️  Empty transcript (possible silence or unsupported format), duration={duration}s")
                else:
                    print(f"⚠️  Empty transcript, skipping")
                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            # Step 4: Create utterance, aggregate tone, send utterance_created + transcript
            utterance_id = str(uuid.uuid4())
            last_utterance_id = utterance_id

            # Aggregate tone from overlapping samples
            aggregated = tone_aggregator.aggregate_for_utterance(
                utterance_start, utterance_end
            )
            tone_label = aggregated["label"] if aggregated else "neutral"
            tone_confidence = aggregated["confidence"] if aggregated else 0.0
            tone_category = get_tone_category(tone_label)

            # Track audio utterances too, so late Hume results can replace neutral labels.
            pending_utterances.append({
                "id": utterance_id,
                "start": utterance_start,
                "end": utterance_end,
                "tone_confidence": tone_confidence,
            })
            if len(pending_utterances) > PENDING_UTTERANCE_LIMIT:
                pending_utterances.pop(0)

            # utterance_created (new contract) - always include tone
            await websocket.send_json({
                "type": "utterance_created",
                "utterance_id": utterance_id,
                "start_time": utterance_start,
                "end_time": utterance_end,
                "text": transcript_text,
                "tone": {"label": tone_label, "confidence": tone_confidence, "source": "audio"},
                "is_final": True,
            })

            # transcript (backward compat)
            await websocket.send_json({
                "type": "transcript",
                "utterance_id": utterance_id,
                "text": transcript_text,
                "tone": tone_label,
                "tone_category": tone_category,
                "tone_confidence": tone_confidence,
                "top_emotions": [],
            })

            # tone_update (ensure frontend gets it with utterance_id)
            await websocket.send_json({
                "type": "tone_update",
                "utterance_id": utterance_id,
                "tone": tone_label,
                "tone_category": tone_category,
                "tone_confidence": tone_confidence,
                "top_emotions": [],
            })
            print(f"⚡ Utterance emitted! id={utterance_id[:8]}... tone={tone_label}")

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
    finally:
        # Notify peers in current room before removing this connection.
        if room_id and room_id in _room_registry:
            for peer in _room_registry.get(room_id, []):
                if peer["ws"] is websocket:
                    continue
                try:
                    await peer["ws"].send_json({
                        "type": "peer_left",
                        "peer_id": client_id,
                    })
                except Exception:
                    continue
        _remove_conn_from_room(conn_info, room_id)
        await prosody_buffer.stop()
        print(f"Conversation WS: cleanup complete")
