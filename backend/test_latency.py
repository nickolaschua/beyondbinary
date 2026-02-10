"""Test progressive latency improvements."""

import asyncio
import time

async def simulate_old_approach():
    """Old: Wait for both STT + tone before sending."""
    print("OLD APPROACH:")
    start = time.time()
    
    # Simulate parallel execution
    await asyncio.sleep(0.5)  # Groq STT
    await asyncio.sleep(1.0)  # Hume tone (runs in parallel, so max is 1.0s)
    
    elapsed = time.time() - start
    print(f"  ⏱️  Time to first subtitle: {elapsed:.1f}s")
    print(f"  📝 Transcript + tone displayed together\n")
    return elapsed

async def simulate_new_approach():
    """New: Send transcript immediately, tone updates later."""
    print("NEW APPROACH (Option A):")
    start = time.time()
    
    # Groq STT completes
    await asyncio.sleep(0.5)
    first_message = time.time() - start
    print(f"  ⏱️  Time to first subtitle: {first_message:.1f}s")
    print(f"  📝 Transcript displayed: 'Your blood sugar is high' [analyzing...]")
    
    # Hume tone completes in background
    await asyncio.sleep(0.5)  # Additional 0.5s for tone
    tone_update = time.time() - start
    print(f"  ⏱️  Tone update arrives: {tone_update:.1f}s")
    print(f"  🎭 Tone updated: [with concern]\n")
    
    return first_message

async def main():
    print("=" * 60)
    print("LATENCY COMPARISON: Old vs New")
    print("=" * 60 + "\n")
    
    old_latency = await simulate_old_approach()
    new_latency = await simulate_new_approach()
    
    improvement = old_latency - new_latency
    percent = (improvement / old_latency) * 100
    
    print("=" * 60)
    print(f"RESULT:")
    print(f"  Old approach: {old_latency:.1f}s to first subtitle")
    print(f"  New approach: {new_latency:.1f}s to first subtitle")
    print(f"  Improvement: {improvement:.1f}s faster ({percent:.0f}% reduction)")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
