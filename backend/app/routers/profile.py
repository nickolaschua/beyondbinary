"""Simple profile management.

For the hackathon, profiles are stored in-memory (no database).
The profile type drives which output channels are active on the frontend.
"""

from fastapi import APIRouter

from app.models.schemas import ProfileCreate, ProfileResponse

router = APIRouter()

_profiles = {}

CHANNEL_CONFIG = {
    "deaf": {
        "audio_output": False,
        "visual_output": True,
        "haptic_output": True,
        "captions": True,
        "tone_badges": True,
        "quick_replies": True,
        "tts_for_replies": True,
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
    },
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
    return {
        "profile_type": "deaf",
        "user_name": user_name,
        "channels": CHANNEL_CONFIG["deaf"],
    }
