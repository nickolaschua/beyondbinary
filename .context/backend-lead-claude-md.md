# CLAUDE.md — Backend Lead: API Orchestration & Deployment
## SenseAI | Beyond Binary Hackathon | 48 Hours

---

## ROLE SUMMARY

You are the backend lead for SenseAI, building the FastAPI server that orchestrates ALL external API integrations and serves as the intelligence layer between the frontend and the ML pipeline. You own every WebSocket and REST endpoint except the ML lead's sign detection inference logic (though you will host his WebSocket too).

**Your deliverables:**
1. A FastAPI server with WebSocket and REST endpoints, deployed to Railway
2. `/ws/conversation` — real-time conversation intelligence (STT → tone analysis → jargon simplification → quick-reply generation)
3. `/api/tts` — text-to-speech via ElevenLabs streaming API
4. `/ws/sign-detection` — proxy/host for the ML lead's sign detection WebSocket (coordinate with ML lead)
5. `/api/profile` — simple profile store (deaf/blind mode switching)
6. Integration with 4 external APIs: Groq (Whisper STT), Hume AI (tone/prosody), Claude/Anthropic (jargon + quick-replies), ElevenLabs (TTS)
7. CORS configuration, health checks, and deployment on Railway

**Your machine:** macOS Apple Silicon. No local GPU needed — all ML runs through external APIs.

**Your experience:** Strong with FastAPI/Flask. This guide focuses on the specific API integrations and WebSocket patterns, not FastAPI basics.

---

## ENVIRONMENT SETUP (macOS Apple Silicon)

### Create Project

```bash
mkdir -p senseai/backend
cd senseai/backend
python3 -m venv venv
source venv/bin/activate
```

### Install Dependencies

```bash
# Core server
pip install fastapi==0.109.0 uvicorn[standard]==0.27.0 websockets==12.0 python-multipart==0.0.6

# External API SDKs
pip install groq==0.4.2               # Groq Whisper STT
pip install hume==0.7.4               # Hume AI Expression Measurement
pip install elevenlabs==1.1.0         # ElevenLabs TTS
pip install anthropic==0.18.0         # Claude API for jargon/quick-replies

# Utilities
pip install python-dotenv==1.0.0      # Environment variable management
pip install httpx==0.26.0             # Async HTTP client (backup for raw API calls)
pip install pydantic==2.5.3           # Data validation (comes with FastAPI)

# Save
pip freeze > requirements.txt
```

### API Key Registration

You need to sign up for ALL of these. Do this FIRST — some take minutes to provision.

| Service | Sign Up URL | Free Tier | Key Name |
|---------|------------|-----------|----------|
| **Groq** | https://console.groq.com | 14,400 audio seconds/day free | `GROQ_API_KEY` |
| **Hume AI** | https://platform.hume.ai | Free tier for Expression Measurement | `HUME_API_KEY` |
| **ElevenLabs** | https://elevenlabs.io | 10,000 chars/month free | `ELEVENLABS_API_KEY` |
| **Anthropic** | https://console.anthropic.com | Pay-as-you-go (very cheap for hackathon usage) | `ANTHROPIC_API_KEY` |
| **Railway** | https://railway.app | $5 free trial credit | (deploy via CLI) |

**Groq sign-up tip:** Groq's free tier is extremely generous for Whisper — 14,400 seconds/day. Create an account, go to API Keys, generate one. It's instant.

**Hume AI sign-up tip:** Create account → Go to Settings → API Keys. The Expression Measurement streaming API is what you need. The free tier should be sufficient for the hackathon.

**ElevenLabs sign-up tip:** Free tier gives 10,000 characters/month. For a hackathon demo, this is enough if you don't waste it on testing. Use short test strings. Pick a voice from their Voice Library — "Rachel" (voice_id: `21m00Tcm4TlvDq8ikWAM`) is a solid default.

**Anthropic sign-up tip:** Create account → API Keys → Generate. Claude Haiku is cheapest and fast enough for quick-reply generation. You'll spend pennies.

### Environment File

Create `backend/.env`:

```env
# Groq (Whisper STT)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Hume AI (Tone/Prosody Analysis)
HUME_API_KEY=xxxxxxxxxxxxxxxxxxxx

# ElevenLabs (Text-to-Speech)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Anthropic (Claude for jargon simplification + quick-reply generation)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx

# Server
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
```

**CRITICAL: Add `.env` to `.gitignore` immediately.**

```bash
echo ".env" >> .gitignore
echo "venv/" >> .gitignore
echo "__pycache__/" >> .gitignore
```

### Verify All API Keys

Create `backend/test_apis.py`:

```python
"""Quick verification that all API keys are valid and services are reachable."""

import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_all():
    errors = []

    # 1. Groq
    print("Testing Groq...")
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        # Groq doesn't have a simple ping — we'll just verify the client initializes
        print("  ✅ Groq client initialized")
    except Exception as e:
        errors.append(f"Groq: {e}")
        print(f"  ❌ Groq: {e}")

    # 2. Hume AI
    print("Testing Hume AI...")
    try:
        from hume import HumeClient
        client = HumeClient(api_key=os.getenv("HUME_API_KEY"))
        print("  ✅ Hume client initialized")
    except Exception as e:
        errors.append(f"Hume: {e}")
        print(f"  ❌ Hume: {e}")

    # 3. ElevenLabs
    print("Testing ElevenLabs...")
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        voices = client.voices.search()
        print(f"  ✅ ElevenLabs connected — {len(voices.voices)} voices available")
    except Exception as e:
        errors.append(f"ElevenLabs: {e}")
        print(f"  ❌ ElevenLabs: {e}")

    # 4. Anthropic
    print("Testing Anthropic...")
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say 'ok'"}]
        )
        print(f"  ✅ Anthropic connected — response: {response.content[0].text}")
    except Exception as e:
        errors.append(f"Anthropic: {e}")
        print(f"  ❌ Anthropic: {e}")

    print(f"\n{'='*40}")
    if errors:
        print(f"❌ {len(errors)} service(s) failed:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("✅ All 4 API services verified!")

asyncio.run(test_all())
```

Run: `python test_apis.py`

**Do NOT proceed until all 4 pass.** If a key is wrong, fix it now. Debugging API auth errors at hour 12 is a time-killer.

---

## PROJECT STRUCTURE

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app entry point, CORS, lifespan
│   ├── config.py                ← Environment variables and settings
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── conversation.py      ← /ws/conversation WebSocket
│   │   ├── tts.py               ← /api/tts REST endpoint
│   │   ├── profile.py           ← /api/profile REST endpoint
│   │   └── sign_detection.py    ← /ws/sign-detection (ML lead's code or proxy)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── groq_stt.py          ← Groq Whisper transcription
│   │   ├── hume_tone.py         ← Hume AI prosody/tone analysis
│   │   ├── claude_intelligence.py ← Claude jargon + quick-reply generation
│   │   ├── elevenlabs_tts.py    ← ElevenLabs TTS streaming
│   │   └── tone_mapper.py       ← Maps Hume's 48 dimensions → simple labels
│   └── models/
│       ├── __init__.py
│       └── schemas.py           ← Pydantic models for request/response
├── .env
├── .gitignore
├── requirements.txt
├── Procfile                     ← Railway deployment
├── railway.toml                 ← Railway configuration
└── test_apis.py
```

---

## STEP 1: APP SKELETON AND CONFIGURATION

### `app/config.py`

```python
"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # API Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    HUME_API_KEY: str = os.getenv("HUME_API_KEY", "")
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Frontend URLs (for CORS)
    FRONTEND_URLS: list = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",  # Will need exact URL once frontend deploys
    ]

settings = Settings()
```

### `app/models/schemas.py`

```python
"""Pydantic models for API request/response validation."""

from pydantic import BaseModel
from typing import Optional

class ProfileCreate(BaseModel):
    profile_type: str  # "deaf" or "blind"
    user_name: Optional[str] = "User"

class ProfileResponse(BaseModel):
    profile_type: str
    user_name: str
    channels: dict  # Which output channels are active

class TTSRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None  # Override default voice

class ConversationMessage(BaseModel):
    """What the frontend receives from /ws/conversation."""
    type: str  # "transcript", "tone", "simplified", "quick_replies", "error"
    data: dict

class QuickReply(BaseModel):
    label: str        # Short button text: "How serious is it?"
    spoken_text: str   # Natural phrasing for TTS: "Could you tell me how serious this is?"
```

### `app/main.py`

```python
"""SenseAI Backend — FastAPI Application Entry Point."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 SenseAI Backend starting...")
    print(f"   Environment: {settings.ENVIRONMENT}")
    print(f"   Groq API: {'✅' if settings.GROQ_API_KEY else '❌'}")
    print(f"   Hume API: {'✅' if settings.HUME_API_KEY else '❌'}")
    print(f"   ElevenLabs API: {'✅' if settings.ELEVENLABS_API_KEY else '❌'}")
    print(f"   Anthropic API: {'✅' if settings.ANTHROPIC_API_KEY else '❌'}")
    yield
    print("👋 SenseAI Backend shutting down...")


app = FastAPI(
    title="SenseAI Backend",
    description="API orchestration for adaptive accessibility companion",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to settings.FRONTEND_URLS in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Import and include routers
from app.routers import conversation, tts, profile

app.include_router(conversation.router, tags=["Conversation"])
app.include_router(tts.router, tags=["TTS"])
app.include_router(profile.router, tags=["Profile"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "services": {
            "groq": bool(settings.GROQ_API_KEY),
            "hume": bool(settings.HUME_API_KEY),
            "elevenlabs": bool(settings.ELEVENLABS_API_KEY),
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
        }
    }
```

### Running Locally

```bash
cd senseai/backend
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Visit `http://localhost:8000/health` to verify.

---

## STEP 2: GROQ WHISPER STT SERVICE

This is the first link in the conversation pipeline. The frontend streams audio → you transcribe it with Groq's Whisper API → pass the text downstream.

**Important:** Groq's Whisper API is NOT a streaming/real-time WebSocket. It's a batch API — you send an audio file, it returns text. For real-time feel, the frontend will chunk audio into short segments (2-5 seconds) and send them sequentially.

### `app/services/groq_stt.py`

```python
"""Groq Whisper Speech-to-Text Service.

Groq hosts OpenAI's Whisper Large v3 Turbo with incredibly fast inference
(216x real-time). We send audio chunks and get back text transcriptions.

The API is batch-based (not streaming), so the frontend sends audio in
short chunks (2-5 seconds) for a near-real-time experience.

Limitations:
- Max file size: 25 MB per request
- Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
- Rate limit: ~50 requests/second (generous for our use case)
"""

import io
import os
from groq import Groq
from app.config import settings

# Initialize client once at module level
_client = Groq(api_key=settings.GROQ_API_KEY)


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    language: str = "en",
    prompt: str = "Medical consultation conversation between a doctor and patient."
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
        # Groq uses the same interface as OpenAI's whisper
        transcription = _client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3-turbo",  # Fastest Whisper model on Groq
            prompt=prompt,
            response_format="verbose_json",  # Includes timestamps and segments
            language=language,
            temperature=0.0,  # Deterministic output
        )

        return {
            "success": True,
            "text": transcription.text,
            "language": getattr(transcription, 'language', language),
            "duration": getattr(transcription, 'duration', None),
            "segments": getattr(transcription, 'segments', []),
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
```

### How the Frontend Sends Audio

Tell Frontend 3 (Conversation Intelligence) this is the protocol:

```javascript
// Frontend captures audio using MediaRecorder API
const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus'  // WebM is supported by Groq Whisper
});

let chunks = [];

mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
};

// Every 3 seconds, send accumulated audio to backend
setInterval(() => {
    if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        chunks = []; // Reset

        // Convert to base64 and send via WebSocket
        const reader = new FileReader();
        reader.onload = () => {
            ws.send(JSON.stringify({
                type: 'audio_chunk',
                audio: reader.result.split(',')[1],  // base64 without prefix
                format: 'webm'
            }));
        };
        reader.readAsDataURL(blob);
    }
}, 3000);
```

---

## STEP 3: HUME AI TONE ANALYSIS SERVICE

Hume's Expression Measurement API analyzes the prosody (tune, rhythm, timbre) of speech and returns 48 dimensions of emotional meaning. We use the streaming WebSocket API for near-real-time analysis.

### `app/services/hume_tone.py`

```python
"""Hume AI Tone/Prosody Analysis Service.

Uses Hume's Expression Measurement streaming API to analyze the emotional
content of speech. Returns 48 dimensions of prosody that we map to
simplified labels for the frontend.

Two modes:
1. Streaming WebSocket (preferred for real-time) — connects to Hume's WS endpoint
2. Batch REST (fallback) — sends audio file, gets results async

For hackathon, we use the batch approach per-chunk since it's simpler
and our audio comes in 3-second chunks anyway.
"""

import base64
import os
from hume import HumeClient
from hume.expression_measurement.batch import Prosody, Models
from app.config import settings
from app.services.tone_mapper import map_prosody_to_label

# Initialize client
_client = HumeClient(api_key=settings.HUME_API_KEY)


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
    try:
        # Encode audio to base64 for Hume API
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

        # Use the streaming WebSocket for real-time analysis
        from hume import AsyncHumeClient
        from hume.expression_measurement.stream import StreamDataModels
        from hume.expression_measurement.stream.types import Config as StreamConfig

        async_client = AsyncHumeClient(api_key=settings.HUME_API_KEY)

        async with async_client.expression_measurement.stream.connect(
            options={"config": StreamDataModels(prosody={})}
        ) as socket:
            result = await socket.send_file(audio_bytes)

            if result and result.prosody and result.prosody.predictions:
                predictions = result.prosody.predictions[0]
                if predictions.emotions:
                    emotions = {e.name: e.score for e in predictions.emotions}
                    sorted_emotions = sorted(emotions.items(), key=lambda x: x[1], reverse=True)

                    primary = sorted_emotions[0]
                    top_5 = [{"name": name, "score": round(score, 3)} for name, score in sorted_emotions[:5]]

                    return {
                        "success": True,
                        "primary_tone": map_prosody_to_label(primary[0]),
                        "primary_raw": primary[0],
                        "confidence": round(primary[1], 3),
                        "top_emotions": top_5,
                        "raw_scores": emotions,
                    }

        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": "No prosody predictions returned",
        }

    except Exception as e:
        print(f"Hume tone analysis error: {e}")
        return {
            "success": False,
            "primary_tone": "neutral",
            "confidence": 0.0,
            "error": str(e),
        }
```

### `app/services/tone_mapper.py`

```python
"""Maps Hume AI's 48 prosody dimensions to simplified, user-friendly labels.

Hume returns emotions like "Concentration", "Contemplation", "Determination",
"Interest", etc. For our deaf user's captions, we simplify these into
intuitive tone labels that add social context.

The labels shown in brackets next to captions, like:
  "[Dr. Lee, speaking carefully]: Your blood sugar is a bit high."
"""

# Map Hume's 48 prosody labels to simplified descriptors
PROSODY_TO_LABEL = {
    # Positive / Warm
    "Joy": "happily",
    "Amusement": "with amusement",
    "Excitement": "excitedly",
    "Interest": "with interest",
    "Satisfaction": "with satisfaction",
    "Pride": "proudly",
    "Admiration": "admiringly",
    "Adoration": "warmly",
    "Love": "warmly",
    "Gratitude": "gratefully",
    "Relief": "with relief",
    "Triumph": "triumphantly",
    "Ecstasy": "excitedly",

    # Calm / Neutral
    "Calmness": "calmly",
    "Contemplation": "thoughtfully",
    "Concentration": "carefully",
    "Determination": "firmly",
    "Realization": "with realization",
    "Nostalgia": "wistfully",
    "Aesthetic Appreciation": "appreciatively",

    # Concern / Negative
    "Sadness": "sadly",
    "Disappointment": "with disappointment",
    "Distress": "with distress",
    "Anxiety": "anxiously",
    "Fear": "nervously",
    "Confusion": "uncertainly",
    "Doubt": "hesitantly",
    "Embarrassment": "hesitantly",
    "Shame": "quietly",
    "Guilt": "apologetically",
    "Awkwardness": "uncomfortably",

    # Strong Negative
    "Anger": "forcefully",
    "Contempt": "dismissively",
    "Disgust": "with displeasure",
    "Annoyance": "with irritation",

    # Empathic
    "Sympathy": "sympathetically",
    "Empathic Pain": "with concern",
    "Compassion": "compassionately",

    # Surprise
    "Surprise (positive)": "with pleasant surprise",
    "Surprise (negative)": "with alarm",
    "Awe": "in awe",

    # Other
    "Boredom": "flatly",
    "Tiredness": "wearily",
    "Pain": "with pain",
    "Craving": "eagerly",
    "Desire": "earnestly",
    "Entrancement": "intently",
    "Horror": "with horror",
}

# Simplified categories for the frontend tone badge
LABEL_TO_CATEGORY = {
    "happily": "positive",
    "with amusement": "positive",
    "excitedly": "positive",
    "with interest": "positive",
    "warmly": "positive",
    "gratefully": "positive",
    "calmly": "neutral",
    "thoughtfully": "neutral",
    "carefully": "neutral",
    "firmly": "neutral",
    "sadly": "negative",
    "with disappointment": "negative",
    "anxiously": "negative",
    "nervously": "negative",
    "forcefully": "negative",
    "with concern": "concern",
    "sympathetically": "concern",
    "compassionately": "concern",
}


def map_prosody_to_label(hume_emotion: str) -> str:
    """Convert a Hume prosody emotion name to a human-friendly label."""
    return PROSODY_TO_LABEL.get(hume_emotion, "speaking")


def get_tone_category(label: str) -> str:
    """Get simplified category (positive/neutral/negative/concern) for a tone label."""
    return LABEL_TO_CATEGORY.get(label, "neutral")
```

---

## STEP 4: CLAUDE INTELLIGENCE SERVICE (Jargon Simplification + Quick-Reply Generation)

This is the "brain" of Conversation Intelligence. Claude receives the transcript + tone context and returns simplified text + contextual quick-reply suggestions.

### `app/services/claude_intelligence.py`

```python
"""Claude API Service for Jargon Simplification and Quick-Reply Generation.

Takes a raw transcript (potentially containing medical/legal/technical jargon)
and the detected tone, then returns:
1. Simplified version of the text (plain language)
2. 3-4 contextual quick-reply suggestions with natural spoken phrasing

Uses Claude Haiku for speed (sub-second responses) and cost efficiency.
"""

import anthropic
from app.config import settings

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Use Haiku for speed — this is latency-critical
MODEL = "claude-3-5-haiku-20241022"


async def process_transcript(
    transcript: str,
    tone_label: str = "speaking",
    conversation_context: str = "",
    profile_type: str = "deaf"
) -> dict:
    """
    Process a conversation transcript through Claude for simplification and quick-replies.

    Args:
        transcript: Raw transcribed text from Groq Whisper
        tone_label: Detected tone from Hume (e.g., "carefully", "with concern")
        conversation_context: Previous transcript lines for context
        profile_type: "deaf" (gets quick-replies) or "blind" (gets audio summary)

    Returns:
        dict with:
            - simplified: Plain language version of the transcript
            - quick_replies: List of {label, spoken_text} for deaf users
            - summary: One-sentence summary for blind users
    """
    if not transcript.strip():
        return {"simplified": "", "quick_replies": [], "summary": ""}

    system_prompt = """You are a real-time accessibility assistant embedded in a conversation intelligence app for people with disabilities. Your job is to process speech transcripts and make them more accessible.

You MUST respond in valid JSON only. No markdown, no explanation, no preamble. Just the JSON object.

Response format:
{
    "simplified": "Plain language version of what was said. Replace medical/legal/technical jargon with simple words. Keep it concise.",
    "quick_replies": [
        {"label": "Short button text (max 6 words)", "spoken_text": "Natural conversational phrasing that will be spoken aloud by TTS"},
        {"label": "Another option", "spoken_text": "Another natural phrasing"}
    ],
    "summary": "One sentence summary of what was just said, suitable for audio delivery to a blind user."
}

Rules:
- Generate 3-4 quick replies that are contextually relevant to what was just said
- Quick reply labels should be SHORT (max 6 words) — they appear on small buttons
- Quick reply spoken_text should sound natural when spoken aloud by TTS
- Always include one reply that asks for clarification and one that acknowledges
- The simplified text should be understandable by a 12-year-old
- The summary should be one sentence, conversational tone, suitable for audio
- If the speaker's tone suggests concern, acknowledge it in the summary"""

    user_message = f"""Transcript: "{transcript}"
Speaker tone: {tone_label}
Previous context: {conversation_context[-500:] if conversation_context else 'Start of conversation'}
User profile: {profile_type}"""

    try:
        response = _client.messages.create(
            model=MODEL,
            max_tokens=500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}]
        )

        response_text = response.content[0].text.strip()

        # Parse JSON response
        import json
        # Handle potential markdown code fences
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        result = json.loads(response_text)

        return {
            "simplified": result.get("simplified", transcript),
            "quick_replies": result.get("quick_replies", []),
            "summary": result.get("summary", transcript),
        }

    except json.JSONDecodeError as e:
        print(f"Claude JSON parse error: {e}")
        print(f"Raw response: {response_text[:200]}")
        # Fallback: return original text with generic quick-replies
        return {
            "simplified": transcript,
            "quick_replies": [
                {"label": "I understand", "spoken_text": "I understand, thank you."},
                {"label": "Can you explain?", "spoken_text": "Could you explain that in simpler terms?"},
                {"label": "One moment", "spoken_text": "One moment please, let me think about that."},
            ],
            "summary": transcript,
        }

    except Exception as e:
        print(f"Claude API error: {e}")
        return {
            "simplified": transcript,
            "quick_replies": [
                {"label": "I understand", "spoken_text": "I understand, thank you."},
                {"label": "Can you repeat?", "spoken_text": "Could you repeat that please?"},
            ],
            "summary": transcript,
        }
```

---

## STEP 5: ELEVENLABS TTS SERVICE

Converts text (like quick-reply spoken_text) into natural-sounding speech audio.

### `app/services/elevenlabs_tts.py`

```python
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

import io
from elevenlabs.client import ElevenLabs
from elevenlabs import stream as play_stream
from app.config import settings

_client = ElevenLabs(api_key=settings.ELEVENLABS_API_KEY)

# Default voice settings
DEFAULT_VOICE_ID = settings.ELEVENLABS_VOICE_ID  # "Rachel" by default
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
            output_format="mp3_22050_32",  # Lower quality = faster + smaller
            voice_settings={
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.0,
                "use_speaker_boost": True,
            }
        )

        # audio is a generator of bytes — collect into single bytes object
        audio_bytes = b""
        for chunk in audio:
            if isinstance(chunk, bytes):
                audio_bytes += chunk

        return audio_bytes

    except Exception as e:
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
            }
        )

        for chunk in audio_stream:
            if isinstance(chunk, bytes):
                yield chunk

    except Exception as e:
        print(f"ElevenLabs TTS stream error: {e}")
        return
```

---

## STEP 6: ROUTERS — THE ACTUAL ENDPOINTS

### `app/routers/conversation.py` — The Main WebSocket

This is the most complex endpoint. It orchestrates the entire conversation pipeline.

```python
"""Conversation Intelligence WebSocket.

Flow:
1. Frontend sends audio chunk (base64 encoded) every 3 seconds
2. Backend transcribes with Groq Whisper
3. Backend analyzes tone with Hume AI (in parallel)
4. Backend processes transcript through Claude for simplification + quick-replies
5. Backend sends results back to frontend

Frontend message format:
    { "type": "audio_chunk", "audio": "<base64>", "format": "webm" }
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

from app.services.groq_stt import transcribe_audio
from app.services.hume_tone import analyze_tone_from_audio
from app.services.claude_intelligence import process_transcript
from app.services.tone_mapper import get_tone_category

router = APIRouter()


@router.websocket("/ws/conversation")
async def conversation_ws(websocket: WebSocket):
    await websocket.accept()
    print(f"Conversation WS: client connected ({websocket.client})")

    # Per-connection state
    profile_type = "deaf"  # Default profile
    conversation_history = ""  # Rolling transcript for context
    is_listening = False

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type", "")

            # Handle control messages
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

            # ========================================
            # PROCESS AUDIO CHUNK
            # ========================================
            await websocket.send_json({"type": "status", "message": "processing"})

            # Decode audio from base64
            audio_b64 = message.get("audio", "")
            audio_format = message.get("format", "webm")
            try:
                audio_bytes = base64.b64decode(audio_b64)
            except Exception as e:
                await websocket.send_json({"type": "error", "message": f"Audio decode error: {e}"})
                continue

            if len(audio_bytes) < 1000:  # Skip tiny/empty chunks
                continue

            # Step 1 + 2: Transcribe and analyze tone IN PARALLEL
            transcript_task = asyncio.create_task(
                transcribe_audio(audio_bytes, filename=f"chunk.{audio_format}")
            )
            tone_task = asyncio.create_task(
                analyze_tone_from_audio(audio_bytes)
            )

            transcript_result, tone_result = await asyncio.gather(
                transcript_task, tone_task, return_exceptions=True
            )

            # Handle errors from parallel tasks
            if isinstance(transcript_result, Exception):
                transcript_result = {"success": False, "text": "", "error": str(transcript_result)}
            if isinstance(tone_result, Exception):
                tone_result = {"success": False, "primary_tone": "neutral", "confidence": 0.0}

            transcript_text = transcript_result.get("text", "").strip()

            if not transcript_text:
                await websocket.send_json({"type": "status", "message": "listening"})
                continue

            tone_label = tone_result.get("primary_tone", "speaking")
            tone_category = get_tone_category(tone_label)

            # Send raw transcript + tone immediately (low latency)
            await websocket.send_json({
                "type": "transcript",
                "text": transcript_text,
                "tone": tone_label,
                "tone_category": tone_category,
                "tone_confidence": tone_result.get("confidence", 0.0),
                "top_emotions": tone_result.get("top_emotions", []),
            })

            # Update conversation history
            conversation_history += f"\n[{tone_label}]: {transcript_text}"
            # Keep history manageable
            if len(conversation_history) > 2000:
                conversation_history = conversation_history[-1500:]

            # Step 3: Process through Claude for simplification + quick-replies
            claude_result = await process_transcript(
                transcript=transcript_text,
                tone_label=tone_label,
                conversation_context=conversation_history,
                profile_type=profile_type,
            )

            # Send simplified text + quick-replies
            await websocket.send_json({
                "type": "simplified",
                "text": claude_result.get("simplified", transcript_text),
                "quick_replies": claude_result.get("quick_replies", []),
            })

            # For blind profile: also send audio summary
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
        except:
            pass
```

### `app/routers/tts.py` — Text-to-Speech Endpoint

```python
"""Text-to-Speech REST endpoint.

When a deaf user taps a quick-reply button, the frontend sends the
spoken_text to this endpoint and receives back an MP3 audio stream
to play through the phone speaker.
"""

from fastapi import APIRouter
from fastapi.responses import StreamingResponse, Response
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

    if not audio_bytes:
        return Response(status_code=500, content="TTS generation failed")

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "no-cache",
        }
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
        }
    )
```

### `app/routers/profile.py` — Profile Management

```python
"""Simple profile management.

For the hackathon, profiles are stored in-memory (no database).
The profile type drives which output channels are active on the frontend.
"""

from fastapi import APIRouter
from app.models.schemas import ProfileCreate, ProfileResponse

router = APIRouter()

# In-memory store (resets on server restart — fine for hackathon)
_profiles = {}

CHANNEL_CONFIG = {
    "deaf": {
        "audio_output": False,
        "visual_output": True,
        "haptic_output": True,
        "captions": True,
        "tone_badges": True,
        "quick_replies": True,
        "tts_for_replies": True,  # Speaks quick-replies aloud for the other person
    },
    "blind": {
        "audio_output": True,
        "visual_output": False,
        "haptic_output": True,
        "captions": False,
        "tone_badges": False,
        "quick_replies": False,
        "tts_for_replies": False,
        "audio_summaries": True,
    }
}


@router.post("/api/profile", response_model=ProfileResponse)
async def create_profile(profile: ProfileCreate):
    profile_data = {
        "profile_type": profile.profile_type,
        "user_name": profile.user_name,
        "channels": CHANNEL_CONFIG.get(profile.profile_type, CHANNEL_CONFIG["deaf"]),
    }
    _profiles[profile.user_name] = profile_data
    return profile_data


@router.get("/api/profile/{user_name}", response_model=ProfileResponse)
async def get_profile(user_name: str):
    if user_name in _profiles:
        return _profiles[user_name]
    # Default deaf profile
    return {
        "profile_type": "deaf",
        "user_name": user_name,
        "channels": CHANNEL_CONFIG["deaf"],
    }
```

---

## STEP 7: DEPLOY TO RAILWAY

### Railway Setup

```bash
# Install Railway CLI
brew install railway

# Login
railway login

# Initialize project
cd senseai/backend
railway init
# Select "Empty Project" when prompted
```

### `Procfile`

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### `railway.toml`

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
```

### Set Environment Variables on Railway

```bash
railway variables set GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
railway variables set HUME_API_KEY=xxxxxxxxxxxxxxxxxxxx
railway variables set ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxx
railway variables set ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
railway variables set ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
railway variables set ENVIRONMENT=production
```

### Deploy

```bash
railway up
```

This takes 2-3 minutes for the first deploy. Railway gives you a URL like `https://senseai-backend-production.up.railway.app`.

**Test it immediately:**
```bash
curl https://your-railway-url.up.railway.app/health
```

### CRITICAL: WebSocket URL for Frontend

Tell the frontend team:
- **REST API:** `https://your-railway-url.up.railway.app`
- **Conversation WebSocket:** `wss://your-railway-url.up.railway.app/ws/conversation`
- **Sign Detection WebSocket:** `wss://your-railway-url.up.railway.app/ws/sign-detection` (or ML lead's separate port)

---

## STEP 8: INTEGRATING ML LEAD'S SIGN DETECTION

You have two options. Decide with the ML lead by hour 12.

### Option A: ML Lead Runs Separate Server (Simpler)

ML lead runs his `ws_server.py` on port 8001. Frontend connects to both servers independently. You don't touch his code.

**Pros:** Zero coordination needed. Each person owns their server.
**Cons:** Frontend connects to 2 different WebSocket URLs. CORS/deployment more complex.

### Option B: You Host His WebSocket (Cleaner)

Copy the ML lead's `/ws/sign-detection` endpoint into your FastAPI app. This requires:
1. Installing mediapipe and tensorflow in YOUR environment
2. Having the `action_model.h5` file in your backend
3. Running his inference code inside your FastAPI process

**Create `app/routers/sign_detection.py`:**

```python
"""Sign Detection WebSocket — proxied from ML lead's code.

This is Option B: hosting the ML lead's sign detection endpoint
within the main backend server. If using Option A (separate server),
this file is not needed.

Requires: mediapipe, tensorflow, opencv-python installed on the server.
Requires: models/action_model.h5 present in the backend directory.
"""

# PLACEHOLDER — ML lead will provide the actual implementation.
# This is the expected interface that the frontend team can code against.

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/sign-detection")
async def sign_detection_placeholder(websocket: WebSocket):
    """
    Placeholder for sign detection WebSocket.

    Expected message format FROM frontend:
        { "type": "frame", "frame": "<base64 jpeg>" }

    Expected response TO frontend:
        { "type": "sign_prediction", "sign": "Hello", "confidence": 0.95,
          "is_stable": true, "is_new_sign": true, "hands_detected": true }
        { "type": "buffering", "frames_collected": 15, "frames_needed": 30,
          "hands_detected": true }

    To enable: replace this placeholder with the ML lead's actual inference code.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({
                "type": "sign_prediction",
                "sign": "Hello",
                "confidence": 0.99,
                "is_stable": True,
                "is_new_sign": False,
                "hands_detected": True,
                "all_predictions": {"Hello": 0.99},
                "frames_processed": 0,
                "_mock": True  # Flag so frontend knows this is placeholder data
            })
    except WebSocketDisconnect:
        pass
```

**Add to `app/main.py`:**
```python
from app.routers import sign_detection
app.include_router(sign_detection.router, tags=["Sign Detection"])
```

This gives the frontend team a working mock endpoint to build against while the ML lead trains the real model.

---

## FALLBACK STRATEGIES

### If Hume AI Is Slow or Down

Replace the Hume tone analysis with a text-based AFINN sentiment fallback:

```python
# app/services/afinn_fallback.py
"""Zero-dependency text sentiment fallback using AFINN-165 lexicon."""

# Simplified AFINN word scores (just the most impactful words)
AFINN = {
    "good": 3, "great": 3, "excellent": 3, "happy": 3, "love": 3,
    "wonderful": 3, "fantastic": 3, "amazing": 3, "perfect": 3,
    "bad": -3, "terrible": -3, "awful": -3, "horrible": -3, "hate": -3,
    "worried": -2, "concerned": -2, "serious": -2, "unfortunately": -2,
    "pain": -2, "hurt": -2, "problem": -2, "risk": -2, "danger": -3,
    "sorry": -1, "difficult": -1, "hard": -1,
    "ok": 1, "fine": 1, "well": 1, "better": 2, "improve": 2,
    "thank": 2, "please": 1, "help": 1,
    "not": 0,  # Handled separately as negation
}

def analyze_text_sentiment(text: str) -> dict:
    words = text.lower().split()
    score = 0
    negation = False
    for word in words:
        if word in ("not", "no", "never", "don't", "doesn't", "isn't", "won't"):
            negation = True
            continue
        if word in AFINN:
            s = AFINN[word]
            if negation:
                s = -s
                negation = False
            score += s
        else:
            negation = False

    if score > 2:
        return {"primary_tone": "positively", "tone_category": "positive", "confidence": 0.6}
    elif score < -2:
        return {"primary_tone": "with concern", "tone_category": "negative", "confidence": 0.6}
    else:
        return {"primary_tone": "speaking", "tone_category": "neutral", "confidence": 0.5}
```

### If ElevenLabs Is Slow or Down

The frontend should fallback to the browser's built-in Web Speech API:

```javascript
// Frontend fallback TTS
function fallbackTTS(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}
```

### If Groq Whisper Is Slow or Down

Frontend falls back to the browser's Web Speech API for STT:

```javascript
// Frontend fallback STT (Chrome only)
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    // Send transcript directly to backend for processing (skip Groq)
    ws.send(JSON.stringify({ type: 'text_input', text: transcript }));
};
```

---

## TIMELINE CHECKLIST

```
HOUR 0-2:   [ ] Environment setup verified (test_apis.py all pass)
            [ ] Project structure created
            [ ] All 4 API keys working

HOUR 2-5:   [ ] FastAPI skeleton running locally
            [ ] /health endpoint working
            [ ] Deployed to Railway (EARLY DEPLOY — do not wait)
            [ ] Railway URL shared with frontend team

HOUR 5-8:   [ ] /ws/conversation WebSocket accepting connections
            [ ] Groq STT working — audio chunk in, text out
            [ ] Sign detection mock endpoint live for frontend

HOUR 8-11:  [ ] Hume AI tone analysis integrated
            [ ] tone_mapper.py returning human-friendly labels
            [ ] Full pipeline: audio → transcript + tone → sent to frontend

HOUR 11-14: [ ] Claude jargon simplification working
            [ ] Quick-reply generation returning 3-4 contextual replies
            [ ] Both deaf and blind profile responses working

HOUR 14-16: [ ] /api/tts endpoint working with ElevenLabs
            [ ] /api/tts/stream endpoint working
            [ ] Frontend can POST text → receive MP3 audio

HOUR 16-20: [ ] PAIR WITH ML LEAD: integrate sign detection WebSocket
            [ ] Either Option A (separate port) or Option B (hosted) decided and working
            [ ] End-to-end: browser video frame → sign prediction returned

HOUR 20-24: [ ] AFINN text sentiment fallback implemented and tested
            [ ] All fallbacks documented and tested
            [ ] Railway deployment updated with latest code

HOUR 24-28: [ ] Stress test: run conversation for 5 minutes continuously
            [ ] Measure latency: audio chunk → transcript should be < 2 seconds
            [ ] Measure latency: quick-reply generation should be < 3 seconds total

HOUR 28-32: [ ] Blind profile audio summaries tested end-to-end
            [ ] Conversation intro feature: app introduces itself via TTS
            [ ] Edge cases: empty audio, network errors, API rate limits

HOUR 32-36: [ ] Final Railway deployment with all features
            [ ] CORS locked down to actual frontend URL
            [ ] Logs clean, no errors in normal operation

HOUR 36-48: [ ] FEATURE FREEZE — no new endpoints
            [ ] Help with demo recording
            [ ] Keep server stable and running for demo video capture
```

---

## COMMUNICATION WITH OTHER TEAM MEMBERS

### To ML Lead:
- "I have a mock `/ws/sign-detection` endpoint running. Frontend can build against it. When your model is ready, either: (A) you run your server on port 8001 and we tell the frontend to connect to both, or (B) you give me your `ws_server.py` and `action_model.h5` and I host it in my server."
- "Let's sync at hour 12 to decide Option A vs B and test the integration."
- "Message format we agreed on: frontend sends `{type: 'frame', frame: '<base64>'}`, you return `{type: 'sign_prediction', sign: 'Hello', confidence: 0.95, is_new_sign: true}`."

### To Frontend 2 (Video Call):
- "For sign detection, connect to `wss://[railway-url]/ws/sign-detection`. Send JPEG frames as base64 at 10 FPS."
- "For now it returns mock data (`_mock: true` flag). When ML lead is ready, real predictions will come through the same WebSocket."

### To Frontend 3 (Conversation Intelligence):
- "Connect to `wss://[railway-url]/ws/conversation`"
- "Protocol:"
  - "Send `{type: 'start_listening'}` when user activates Listen mode"
  - "Send `{type: 'set_profile', profile_type: 'deaf'}` to set the user's profile"
  - "Send `{type: 'audio_chunk', audio: '<base64>', format: 'webm'}` every 3 seconds"
  - "You'll receive: `{type: 'transcript', text: '...', tone: 'carefully'}` first (fast)"
  - "Then: `{type: 'simplified', text: '...', quick_replies: [...]}` (1-2 seconds later)"
  - "Send `{type: 'stop_listening'}` when user exits Listen mode"
- "For TTS when user taps a quick-reply: `POST /api/tts` with `{text: 'spoken text'}`, response is raw MP3 bytes"

### To Frontend 1 (App Shell):
- "My server base URL will be `https://[railway-url]`"
- "`POST /api/profile` to create a user profile after onboarding"
- "`GET /api/profile/{user_name}` to retrieve channel configuration"
- "The channel config tells you which UI elements to show/hide for each profile type"

---

## API QUICK REFERENCE

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/health` | GET | Server health check | — | `{status, services}` |
| `/api/profile` | POST | Create user profile | `{profile_type, user_name}` | `{profile_type, channels}` |
| `/api/profile/{name}` | GET | Get user profile | — | `{profile_type, channels}` |
| `/api/tts` | POST | Text to speech (batch) | `{text, voice_id?}` | MP3 audio bytes |
| `/api/tts/stream` | POST | Text to speech (streaming) | `{text, voice_id?}` | Streaming MP3 |
| `/ws/conversation` | WS | Conversation intelligence | Audio chunks | Transcript + tone + quick-replies |
| `/ws/sign-detection` | WS | Sign language detection | Video frames | Sign predictions |

---

## FILE MANIFEST

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── conversation.py
│   │   ├── tts.py
│   │   ├── profile.py
│   │   └── sign_detection.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── groq_stt.py
│   │   ├── hume_tone.py
│   │   ├── claude_intelligence.py
│   │   ├── elevenlabs_tts.py
│   │   ├── tone_mapper.py
│   │   └── afinn_fallback.py
│   └── models/
│       ├── __init__.py
│       └── schemas.py
├── .env
├── .gitignore
├── requirements.txt
├── Procfile
├── railway.toml
├── test_apis.py
└── CLAUDE.md                    ← This file
```

### requirements.txt

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
websockets==12.0
python-multipart==0.0.6
groq==0.4.2
hume==0.7.4
elevenlabs==1.1.0
anthropic==0.18.0
python-dotenv==1.0.0
httpx==0.26.0
pydantic==2.5.3
```
