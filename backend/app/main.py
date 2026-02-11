"""SenseAI Backend — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("SenseAI Backend starting...")
    print(f"   Environment: {settings.ENVIRONMENT}")
    print(f"   Groq API: {'OK' if settings.GROQ_API_KEY else 'MISSING'}")
    print(f"   OpenAI API (Whisper STT): {'OK' if settings.OPENAI_API_KEY else 'MISSING'}")
    print(f"   Hume API: {'OK' if settings.HUME_API_KEY else 'MISSING'}")
    print(f"   ElevenLabs API: {'OK' if settings.ELEVENLABS_API_KEY else 'MISSING'}")
    print(f"   Anthropic API: {'OK' if settings.ANTHROPIC_API_KEY else 'MISSING'}")
    yield
    print("SenseAI Backend shutting down...")


app = FastAPI(
    title="SenseAI Backend",
    description="API orchestration for adaptive accessibility companion",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — phone compatibility: allow mobile PWA origins
_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]
if settings.FRONTEND_ORIGIN:
    _origins = [
        settings.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "capacitor://localhost",
        "ionic://localhost",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import braille, conversation, profile, sign_detection, tts

app.include_router(conversation.router, tags=["Conversation"])
app.include_router(tts.router, tags=["TTS"])
app.include_router(profile.router, tags=["Profile"])
app.include_router(sign_detection.router, tags=["Sign Detection"])
app.include_router(braille.router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "services": {
            "groq": bool(settings.GROQ_API_KEY),
            "openai": bool(settings.OPENAI_API_KEY),
            "hume": bool(settings.HUME_API_KEY),
            "elevenlabs": bool(settings.ELEVENLABS_API_KEY),
            "anthropic": bool(settings.ANTHROPIC_API_KEY),
        },
    }
