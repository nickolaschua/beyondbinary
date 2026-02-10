// client/ai/tone.js
// Tone detection (PLACEHOLDER)

class ToneDetector {
  constructor() {
    this.onToneUpdate = null;
    this.intervalId = null;
  }

  start(audioTap) {
    // PLACEHOLDER: Connect to tone service (e.g. backend prosody buffer ~0.8s interval)
    console.log('[Tone] Started (placeholder)');
    
    // Low-latency demo: simulate tone every 1.5s (real: backend analyzes every ~0.8s)
    const TONE_INTERVAL_MS = 1500;
    this.intervalId = setInterval(() => {
      if (this.onToneUpdate) {
        const tones = ['neutral', 'happy', 'concerned', 'excited'];
        const randomTone = tones[Math.floor(Math.random() * tones.length)];
        this.onToneUpdate({ tone: randomTone, confidence: 0.75 });
      }
    }, TONE_INTERVAL_MS);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[Tone] Stopped');
  }
}

export { ToneDetector };
