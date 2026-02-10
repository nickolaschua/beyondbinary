# YouTube-Level Instant Captions with Web Speech API

## Frontend Integration Guide

### Option 1: Web Speech API Only (FASTEST - ~100ms latency)

```javascript
// Initialize Web Speech Recognition
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;  // Get partial results!
recognition.lang = 'en-US';

recognition.onresult = (event) => {
    const lastResultIndex = event.results.length - 1;
    const result = event.results[lastResultIndex];
    const transcript = result[0].transcript;
    const isFinal = result.isFinal;

    // Send to backend
    ws.send(JSON.stringify({
        type: 'text_transcript',
        text: transcript,
        is_final: isFinal
    }));
    
    // Display immediately (YouTube-style!)
    displaySubtitle(transcript, isFinal ? 'final' : 'interim');
};

recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
};

recognition.start();
```

**Latency:** < 200ms (words appear as spoken!)

---

### Option 2: Hybrid (Web Speech + Groq Whisper)

Use Web Speech for instant display, then verify with Groq:

```javascript
let currentWebSpeechText = '';
let audioChunks = [];

// 1. Web Speech for instant display
recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript;
    const isFinal = event.results[event.results.length - 1].isFinal;
    
    currentWebSpeechText = transcript;
    
    // Show instantly (may have errors)
    displaySubtitle(transcript, 'web_speech', isFinal);
    
    if (isFinal) {
        ws.send(JSON.stringify({
            type: 'text_transcript',
            text: transcript,
            is_final: true
        }));
    }
};

// 2. Audio recording for Groq verification (every 2 seconds)
mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
};

setInterval(() => {
    if (audioChunks.length === 0) return;
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];
    
    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
        ws.send(JSON.stringify({
            type: 'audio_chunk',
            audio: reader.result.split(',')[1],
            format: 'webm'
        }));
    };
    reader.readAsDataURL(audioBlob);
}, 2000);  // Send audio every 2s for accurate transcription
```

**Display logic:**
```javascript
function displaySubtitle(text, source, isFinal) {
    const subtitleEl = document.getElementById('subtitle');
    
    if (source === 'web_speech') {
        // Show immediately with visual indicator
        subtitleEl.textContent = text;
        subtitleEl.classList.add('interim');  // Gray/italic
    }
    
    if (source === 'groq_whisper') {
        // Update with accurate version
        subtitleEl.textContent = text;
        subtitleEl.classList.remove('interim');
        subtitleEl.classList.add('verified');  // Green checkmark
    }
}
```

---

### Option 3: Smaller Audio Chunks (EASY WIN)

Just reduce chunk size (no Web Speech):

```javascript
// Change from 3000ms to 1000ms
setInterval(() => {
    sendAudioChunk();
}, 1000);  // 1 second chunks instead of 3
```

**Latency:** 1s (chunk) + 0.5s (Groq) = 1.5s total

---

## Comparison

| Method | Latency | Accuracy | Browser Support | API Cost |
|--------|---------|----------|-----------------|----------|
| **Web Speech Only** | ~200ms | Medium | Chrome/Edge | Free |
| **Hybrid** | ~200ms + verify | High | Chrome/Edge | Low |
| **Smaller Chunks** | ~1.5s | High | All | Medium |
| **Current (3s chunks)** | ~3.5s | High | All | Low |

## Recommendation

**For your demo:** Use **Hybrid approach**
- Users see instant YouTube-style captions (Web Speech)
- Backend verifies accuracy with Groq (medical jargon corrections)
- Best of both worlds!

## Browser Compatibility

```javascript
// Feature detection
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    // Use Web Speech API
    useWebSpeech();
} else {
    // Fallback to audio chunks
    useAudioChunks();
}
```

---

## Backend is Ready!

Backend now accepts:
- `{ "type": "text_transcript", "text": "...", "is_final": true }` ✅
- `{ "type": "audio_chunk", "audio": "<base64>", "format": "webm" }` ✅

Both work simultaneously!
