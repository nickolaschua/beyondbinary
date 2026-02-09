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
    label: str  # Short button text: "How serious is it?"
    spoken_text: str  # Natural phrasing for TTS: "Could you tell me how serious this is?"
