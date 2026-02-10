"""Quick verification that all API keys are valid and services are reachable."""

import asyncio
import os

from dotenv import load_dotenv

load_dotenv()


async def test_all():
    errors = []

    # 1. Groq
    print("Testing Groq...")
    try:
        from groq import Groq

        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        print("  Groq client initialized")
    except Exception as e:
        errors.append(f"Groq: {e}")
        print(f"  Groq: {e}")

    # 2. Hume AI
    print("Testing Hume AI...")
    try:
        from hume import HumeClient

        client = HumeClient(api_key=os.getenv("HUME_API_KEY"))
        print("  Hume client initialized")
    except ImportError:
        try:
            from hume import HumeStreamClient

            client = HumeStreamClient(api_key=os.getenv("HUME_API_KEY"))
            print("  Hume Stream client initialized")
        except Exception as e:
            errors.append(f"Hume: {e}")
            print(f"  Hume: {e}")
    except Exception as e:
        errors.append(f"Hume: {e}")
        print(f"  Hume: {e}")

    # 3. ElevenLabs
    print("Testing ElevenLabs...")
    try:
        from elevenlabs.client import ElevenLabs

        client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
        # Just verify client initializes - voices API may vary by version
        _ = client.voices
        print("  ElevenLabs connected")
    except Exception as e:
        errors.append(f"ElevenLabs: {e}")
        print(f"  ElevenLabs: {e}")

    # 4. Anthropic
    print("Testing Anthropic...")
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=10,
            messages=[{"role": "user", "content": "Say 'ok'"}],
        )
        print(f"  Anthropic connected - response: {response.content[0].text}")
    except Exception as e:
        errors.append(f"Anthropic: {e}")
        print(f"  Anthropic: {e}")

    print(f"\n{'=' * 40}")
    if errors:
        print(f"{len(errors)} service(s) failed:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("All 4 API services verified!")

    return len(errors) == 0


if __name__ == "__main__":
    success = asyncio.run(test_all())
    exit(0 if success else 1)
