"""Claude API Service for Jargon Simplification and Quick-Reply Generation.

Takes a raw transcript (potentially containing medical/legal/technical jargon)
and the detected tone, then returns:
1. Simplified version of the text (plain language)
2. 3-4 contextual quick-reply suggestions with natural spoken phrasing

Uses Claude Haiku for speed (sub-second responses) and cost efficiency.
"""

import asyncio
import json

import anthropic

from app.config import settings

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
MODEL = "claude-3-5-haiku-20241022"


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

    response_text = ""
    try:
        # Anthropic client is sync — run in thread to avoid blocking
        def _call():
            response = _client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text.strip()

        response_text = await asyncio.to_thread(_call)

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
        print(f"Raw response: {response_text[:200] if response_text else 'N/A'}")
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
