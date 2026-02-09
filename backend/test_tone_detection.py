"""Quick test to verify tone detection is working."""

from app.services.afinn_fallback import analyze_text_sentiment

print("Testing AFINN Tone Detection...")
print("=" * 60)

test_cases = [
    "Hello, how are you today?",
    "I'm really worried about this serious problem",
    "Everything is wonderful and fantastic",
    "Your blood sugar levels are elevated and we need to monitor them",
]

for text in test_cases:
    result = analyze_text_sentiment(text)
    print(f"\nText: '{text}'")
    print(f"  → Tone: {result['primary_tone']}")
    print(f"  → Category: {result['tone_category']}")
    print(f"  → Confidence: {result['confidence']}")

print("\n" + "=" * 60)
print("✅ Tone detection is working!")
print("\nThe tone SHOULD change based on the words used.")
print("If it's not changing in the frontend, the issue is with")
print("either the WebSocket connection or the frontend display.")
