# STT, Transcription & Tone Detection — How It Works

Summary of how speech-to-text, transcription flow, and tone detection are wired in the conversation WebSocket.

---

## 1. Two Input Paths (STT vs. Web Speech)

The backend accepts **two** ways to get “what was said”:

| Path | Message type | Source | When used |
|------|--------------|--------|-----------|
| **Audio chunks** | `audio_chunk` | Frontend records mic, sends base64 audio | Deaf profile: server does STT + tone from audio |
| **Text transcript** | `text_transcript` | Browser Web Speech API (client-side STT) | “Instant captions” mode: no server STT, text-only tone |

Both paths only run when `is_listening` is true (after `start_listening`). Profile is set via `set_profile` (`deaf` / `blind`).

---

## 2. Speech-to-Text (STT) — Audio Path Only

**Where:** `app/services/openai_stt.py`  
**Used when:** Frontend sends `audio_chunk` (not for `text_transcript`).

- **Engine:** OpenAI Whisper API (`whisper-1`).
- **Input:** Raw audio bytes (e.g. webm, mp4/m4a, wav). Filename hint from `get_filename_for_format(format)` (e.g. `format: "webm"` → `chunk.webm`).
- **Call:** `transcribe_audio(audio_bytes, filename=..., language="en", prompt="Live speech or conversation for real-time captioning.")`.
- **Output:** Dict with `text`, `language`, `duration`, `segments`. On error: `success: False`, `error`, empty `text`.
- **Convenience:** `transcribe_audio_simple(...)` returns only the transcript string.

So **transcription** in this codebase means: “turn the audio chunk into text using Whisper.” That text is then used for subtitles, history, and downstream Claude/simplification.

---

## 3. Transcription Flow (What Happens to the Text)

After text is obtained (either from Whisper or from Web Speech), the flow is:

1. **Emit subtitle immediately**  
   Backend sends a `transcript` message with:
   - `text`
   - Current tone info (`tone`, `tone_category`, `tone_confidence`, `top_emotions`) — see tone section below.
   - For Web Speech: `source: "web_speech"`, `is_final`.

2. **Append to conversation history**  
   `conversation_history += "\n[{tone_label}]: {transcript_text}"`, trimmed to last ~1500 chars when over 2000.

3. **Claude processing**  
   `process_transcript(transcript=..., tone_label=..., conversation_context=..., profile_type=...)` produces:
   - Simplified wording
   - Quick replies
   - For blind profile: summary

4. **Send to frontend**  
   - `simplified`: simplified text + `quick_replies`
   - If `profile_type === "blind"`: also `summary` (“The speaker said {tone}: {summary}”).

So **transcription** in the product sense is: “get words from audio or typed/Web Speech text, then show as captions and feed into simplification/summary.”

---

## 4. Tone Detection — Two Modes

Tone is computed differently for the two input paths.

### 4a. Audio path (Hume + prosody buffer)

When the client sends **audio chunks**:

- **Prosody buffer** (`app/services/prosody_buffer.py`):
  - Keeps a **sliding window** of recent audio (e.g. 2.5 s).
  - Every **0.8 s** (configurable), a background task takes the current window, truncates to Hume’s limit (last ~5 s, ~81 KB), and calls the tone analyzer.
  - Tone analyzer = **Hume** (`analyze_tone_from_audio` in `app/services/hume_tone.py`).
  - Result is cached as “current tone”; when it’s updated, a **callback** sends a `tone_update` message to the frontend.

- **Hume** (`app/services/hume_tone.py`):
  - Uses Hume Expression Measurement **stream** API, **prosody** model (voice emotion), not language.
  - Sends a temp file (e.g. `.webm`) with the window; Hume returns prosody predictions (e.g. 48 dimensions).
  - Primary emotion is chosen from scores (with simple rules to prefer less generic labels when scores are close).
  - **Tone mapper** (`app/services/tone_mapper.py`): Hume emotion names (e.g. "Concentration", "Joy") → short labels (e.g. "carefully", "happily") and categories (`positive` / `neutral` / `negative` / `concern`).

- **Decoupled from STT:**  
  Subtitle is sent as soon as Whisper returns. Tone is sent when the prosody buffer’s analysis completes (often shortly after), so the first `transcript` may still show the previous or “neutral” tone; `tone_update` brings the new one.

### 4b. Text-only path (Web Speech) — AFINN fallback

When the client sends **text_transcript** (no server-side audio):

- There is **no audio** for Hume, so tone is **text-based** only.
- **AFINN fallback** (`app/services/afinn_fallback.py`):  
  Uses a small word-sentiment lexicon (AFINN-style). Sums scores over words (with simple negation handling) and maps to:
  - `primary_tone`: e.g. "positively", "with concern", "speaking"
  - `tone_category`: "positive" / "negative" / "neutral"
  - `confidence`: fixed 0.5 or 0.6
- For **final** transcripts only: this tone is sent once as `tone_update` and used for that utterance’s history and Claude call. Interim transcripts get `tone: "analyzing..."` / `interim` and no AFINN run until final.

So:

- **Audio path:** tone = **Hume prosody** (voice) + sliding window + tone mapper; updates stream via `tone_update`.
- **Text path:** tone = **AFINN** on transcript text; one tone per final transcript.

---

## 5. End-to-End (Audio Path)

1. Client sends `audio_chunk` (base64, format e.g. webm).
2. **Prosody buffer** appends chunk (non-blocking); background loop runs Hume every 0.8 s on the last ~2.5 s of audio; when ready, sends `tone_update`.
3. **Whisper** transcribes the same (or same session) audio → `transcript_text`.
4. Backend sends **`transcript`** immediately with current (possibly previous) tone.
5. Conversation history is updated; **Claude** runs for simplified + quick_replies (and summary if blind).
6. Backend sends **`simplified`** (and **`summary`** if blind).
7. When the next Hume result is ready, backend sends **`tone_update`** (so UI can refresh tone for that segment if desired).

---

## 6. Files Involved

| Concern | File(s) |
|--------|--------|
| STT (Whisper) | `app/services/openai_stt.py` |
| Tone from audio (Hume) | `app/services/hume_tone.py` |
| Tone from text (fallback) | `app/services/afinn_fallback.py` |
| Hume → labels/categories | `app/services/tone_mapper.py` |
| Sliding-window prosody | `app/services/prosody_buffer.py` |
| Orchestration (WS, flow) | `app/routers/conversation.py` |
| Downstream (simplify, quick replies, summary) | `app/services/claude_intelligence.py` (referenced in router) |

---

## 7. Quick Reference

- **STT:** OpenAI Whisper on server; only for `audio_chunk`. Web Speech path has no server STT.
- **Transcription:** Either Whisper output or Web Speech text; both are treated as “transcript” and drive subtitles, history, simplification, and (for blind) summary.
- **Tone (audio):** Hume prosody on a sliding window (ProsodyBuffer), mapped to labels/categories; updates sent via `tone_update`.
- **Tone (text):** AFINN on final `text_transcript` only; one `tone_update` per final utterance.
