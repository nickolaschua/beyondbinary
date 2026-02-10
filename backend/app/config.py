"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # API Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
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

    # Phone compatibility
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "")  # Exact URL for production CORS
    MOBILE_MODE: bool = os.getenv("MOBILE_MODE", "true").lower() == "true"
    MAX_AUDIO_CHUNK_BYTES: int = int(os.getenv("MAX_AUDIO_CHUNK_BYTES", "500000"))  # ~500KB


settings = Settings()
