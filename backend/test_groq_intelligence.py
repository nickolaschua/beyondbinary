"""Test Groq quick-reply generation."""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

# Import after loading env
from app.services.claude_intelligence import process_transcript

async def test():
    print("Testing Groq quick-reply generation...")
    
    result = await process_transcript(
        transcript="Your blood sugar is a bit high.",
        tone_label="carefully",
        conversation_context="",
        profile_type="deaf"
    )
    
    print("\n✅ Result:")
    print(f"Simplified: {result.get('simplified')}")
    print(f"\nQuick Replies:")
    for reply in result.get('quick_replies', []):
        print(f"  - [{reply.get('label')}] → \"{reply.get('spoken_text')}\"")
    print(f"\nSummary: {result.get('summary')}")

if __name__ == "__main__":
    asyncio.run(test())
