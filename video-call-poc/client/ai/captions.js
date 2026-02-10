// client/ai/captions.js
// Live subtitle generation (PLACEHOLDER)

class CaptionsEngine {
  constructor() {
    this.onCaption = null;
    this.intervalId = null;
  }

  start(audioTap) {
    // PLACEHOLDER: Connect to STT service (e.g. backend /ws/conversation or Web Speech API)
    console.log('[Captions] Started (placeholder)');

    // Low-latency demo: simulate captions every 1.2s (real integration: stream small chunks or use Web Speech)
    const samplePhrases = [
      'Hello, how are you?',
      'This is a sample caption',
      'The audio is being analyzed',
      'Captions will appear here',
      'Testing the caption system'
    ];

    let phraseIndex = 0;
    const CAPTION_INTERVAL_MS = 1200; // Lower = snappier; real STT: use ~1–1.5s chunks or streaming
    this.intervalId = setInterval(() => {
      if (this.onCaption) {
        this.onCaption({
          text: samplePhrases[phraseIndex % samplePhrases.length],
          confidence: 0.85 + Math.random() * 0.15
        });
        phraseIndex++;
      }
    }, CAPTION_INTERVAL_MS);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[Captions] Stopped');
  }
}

export { CaptionsEngine };
