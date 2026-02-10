"""Groq LLM Service for Jargon Simplification and Quick-Reply Generation.

Takes a raw transcript (potentially containing medical/legal/technical jargon)
and the detected tone, then returns:
1. Simplified version of the text (plain language)
2. 3-4 contextual quick-reply suggestions with natural spoken phrasing

Uses Groq's Llama 3.1 70B for speed (very fast inference) and zero cost.
"""

import asyncio
import json

from groq import Groq

from app.config import settings

_client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = "llama-3.3-70b-versatile"  # Latest Llama model, fast, good at JSON, free


def _normalize_quick_replies(items: list) -> list:
    """Keep quick-reply labels readable and bounded for UI buttons."""
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()
        spoken = str(item.get("spoken_text", "")).strip()
        if not label:
            continue
        if not spoken:
            spoken = label
        # Target slightly longer labels while preventing giant button text.
        if len(label) > 40:
            label = label[:40].rstrip() + "…"
        normalized.append({"label": label, "spoken_text": spoken})
    return normalized[:4]


async def process_transcript(
    transcript: str,
    tone_label: str = "speaking",
    conversation_context: str = "",
    profile_type: str = "deaf",
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
        {"label": "Button text (aim for 20-40 characters)", "spoken_text": "Natural conversational phrasing that will be spoken aloud by TTS"},
        {"label": "Another option", "spoken_text": "Another natural phrasing"}
    ],
    "summary": "One sentence summary of what was just said, suitable for audio delivery to a blind user."
}

Rules:
- Generate 3-4 quick replies that are contextually relevant to what was just said
- Quick reply labels should be concise but more descriptive (target 20-40 characters)
- Quick reply spoken_text should sound natural when spoken aloud by TTS
- Always include one reply that asks for clarification and one that acknowledges
- The simplified text should be understandable by a 12-year-old
- The summary should be one sentence, conversational tone, suitable for audio
- If the speaker's tone suggests concern, acknowledge it in the summary"""

    user_message = f"""Transcript: "{transcript}"
Speaker tone: {tone_label}
Previous context: {conversation_context[-500:] if conversation_context else 'Start of conversation'}
User profile: {profile_type}"""

    response_text = ""
    try:
        # Groq client is sync — run in thread to avoid blocking
        def _call():
            response = _client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=500,
                temperature=0.3,  # Lower = more focused/consistent
                response_format={"type": "json_object"}  # Force JSON output
            )
            return response.choices[0].message.content.strip()

        response_text = await asyncio.to_thread(_call)

        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        result = json.loads(response_text)

        return {
            "simplified": result.get("simplified", transcript),
            "quick_replies": _normalize_quick_replies(result.get("quick_replies", [])),
            "summary": result.get("summary", transcript),
        }

    except json.JSONDecodeError as e:
        print(f"Groq JSON parse error: {e}")
        print(f"Raw response: {response_text[:200] if response_text else 'N/A'}")
        return {
            "simplified": transcript,
            "quick_replies": [
                {"label": "I understand", "spoken_text": "I understand."},
                {"label": "Can you explain?", "spoken_text": "Could you explain that in simpler terms?"},
                {"label": "One moment", "spoken_text": "One moment please, let me think about that."},
            ],
            "summary": transcript,
        }
    except Exception as e:
        print(f"Groq LLM API error: {e}")
        return {
            "simplified": transcript,
            "quick_replies": [
                {"label": "I understand", "spoken_text": "I understand."},
                {"label": "Can you repeat?", "spoken_text": "Could you repeat that please?"},
            ],
            "summary": transcript,
        }
