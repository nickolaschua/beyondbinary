// client/ai/backendConnector.js
// Connects to Beyond Binary backend WebSocket: sends local audio and/or Web Speech text.

import { getBackendWsUrl, AUDIO_CHUNK_INTERVAL_MS } from '../config.js';

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export class BackendConnector {
  constructor() {
    this.ws = null;
    this.recorder = null;
    this.chunkIntervalId = null;
    this.recognition = null;
    this.onTranscript = null;
    this.onToneUpdate = null;
    this.onUtteranceCreated = null;
    this.onLiveCaption = null;
    this.onStatus = null;
    this.onError = null;
    this.onChatMessage = null;
    this.onTtsChunk = null;
    this.onTtsAudioEnd = null;
    this.onTtsError = null;
    this._useWebSpeech = !!SpeechRecognition;
    this._roomId = null;
    this._profileType = 'deaf';
    this._wantsTts = true;  // "TTS On" by default = want incoming chat read aloud
  }

  setTtsPreference(wants) {
    this._wantsTts = !!wants;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'set_tts_preference', value: this._wantsTts }));
    }
  }

  setProfile(profileType) {
    this._profileType = profileType === 'blind' ? 'blind' : 'deaf';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'set_profile', profile_type: this._profileType }));
    }
  }

  setRoom(roomId) {
    this._roomId = roomId || null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this._roomId) {
      this.ws.send(JSON.stringify({ type: 'set_room', room: this._roomId }));
      this.ws.send(JSON.stringify({ type: 'set_tts_preference', value: this._wantsTts }));
    }
  }

  sendChatMessage(text, tts = false) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this._roomId) return;
    this.ws.send(JSON.stringify({
      type: 'chat_message',
      room: this._roomId,
      sender: 'local',
      text: String(text).trim(),
      tts: !!tts,
    }));
  }

  async start(stream) {
    const baseUrl = getBackendWsUrl();
    const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ws/conversation';
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        console.log('[Backend] WebSocket connected');
        this.ws.send(JSON.stringify({ type: 'set_profile', profile_type: this._profileType }));
        this.ws.send(JSON.stringify({ type: 'start_listening', use_web_speech: this._useWebSpeech }));
        if (this._roomId) {
          this.ws.send(JSON.stringify({ type: 'set_room', room: this._roomId }));
        }
        this.ws.send(JSON.stringify({ type: 'set_tts_preference', value: this._wantsTts }));
        if (this._useWebSpeech) {
          this._startWebSpeech(stream);
          this._startRecording(stream);
          console.log('[Backend] Hybrid: Web Speech captions + audio for Hume tone');
        } else {
          this._startRecording(stream);
        }
        if (this.onStatus) this.onStatus('listening');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'utterance_created': {
              const payload = {
                utterance_id: msg.utterance_id,
                text: msg.text,
                start_time: msg.start_time,
                end_time: msg.end_time,
                tone: msg.tone,
                is_final: msg.is_final,
              };
              if (this.onUtteranceCreated) this.onUtteranceCreated(payload);
              if (msg.text != null && this.onTranscript) {
                this.onTranscript({
                  text: msg.text,
                  utterance_id: msg.utterance_id,
                  tone: msg.tone?.label,
                  confidence: msg.tone?.confidence ?? 0,
                  is_final: msg.is_final,
                });
              }
              if (msg.tone != null && msg.utterance_id != null && this.onToneUpdate) {
                this.onToneUpdate({
                  tone: msg.tone.label,
                  confidence: msg.tone.confidence,
                  utterance_id: msg.utterance_id,
                });
              }
              break;
            }
            case 'transcript': {
              const payload = {
                text: msg.text,
                tone: msg.tone,
                confidence: msg.tone_confidence ?? 0,
                is_final: msg.is_final,
                source: msg.source,
              };
              if (msg.utterance_id != null) payload.utterance_id = msg.utterance_id;
              if (msg.text != null && this.onTranscript) this.onTranscript(payload);
              if (msg.tone != null && this.onToneUpdate) this.onToneUpdate(payload);
              break;
            }
            case 'tone_update': {
              const payload = {
                tone: msg.tone,
                confidence: msg.tone_confidence ?? 0,
                tone_category: msg.tone_category,
                top_emotions: msg.top_emotions ?? [],
              };
              if (msg.utterance_id != null) payload.utterance_id = msg.utterance_id;
              if (msg.tone != null && this.onToneUpdate) this.onToneUpdate(payload);
              break;
            }
            case 'status':
              if (this.onStatus) this.onStatus(msg.message);
              break;
            case 'error':
              console.error('[Backend]', msg.message);
              if (this.onError) this.onError(msg.message);
              break;
            case 'chat_message':
              if (this.onChatMessage) {
                this.onChatMessage({
                  room: msg.room,
                  sender: msg.sender,
                  text: msg.text,
                  tts: msg.tts,
                });
              }
              break;
            case 'tts_audio_chunk':
              if (this.onTtsChunk && msg.audio_base64) this.onTtsChunk(msg.audio_base64);
              break;
            case 'tts_audio_end':
              if (this.onTtsAudioEnd) this.onTtsAudioEnd();
              break;
            case 'tts_error':
              console.warn('[Backend] TTS error:', msg.message);
              if (this.onTtsError) this.onTtsError(msg.message);
              if (this.onError) this.onError(msg.message);
              break;
            default:
              break;
          }
        } catch (e) {
          console.warn('[Backend] Parse message error', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[Backend] WebSocket error', err);
        if (this.onError) this.onError('Connection error');
        reject(err);
      };

      this.ws.onclose = () => {
        console.log('[Backend] WebSocket closed');
        if (this._useWebSpeech) this._stopWebSpeech();
        this._stopRecording();
      };
    });
  }

  _startWebSpeech(stream) {
    if (!SpeechRecognition || !this.ws) return;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const lastResultIndex = event.results.length - 1;
      const result = event.results[lastResultIndex];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;

      if (!transcript.trim()) return;

      if (this.onLiveCaption) this.onLiveCaption(transcript.trim(), isFinal);

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'text_transcript',
          text: transcript.trim(),
          is_final: isFinal,
        }));
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') console.warn('[Web Speech]', event.error);
    };

    this.recognition.start();
  }

  _stopWebSpeech() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }

  _startRecording(stream) {
    this._recordStream = stream;
    this._sendNextChunk();
  }

  _sendNextChunk() {
    if (!this._recordStream || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const stream = this._recordStream;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn('[Backend] No audio track in stream');
      this.chunkIntervalId = setTimeout(() => this._sendNextChunk(), AUDIO_CHUNK_INTERVAL_MS);
      return;
    }

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const options = mimeType
      ? { mimeType, audioBitsPerSecond: 128000 }
      : {};
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      const fallbackOptions = mimeType ? { mimeType } : {};
      try {
        recorder = new MediaRecorder(stream, fallbackOptions);
      } catch (e2) {
        try {
          recorder = new MediaRecorder(stream);
        } catch (e3) {
          console.error('[Backend] MediaRecorder constructor failed:', e3);
          this.chunkIntervalId = setTimeout(() => this._sendNextChunk(), AUDIO_CHUNK_INTERVAL_MS);
          return;
        }
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          if (base64) {
            this.ws.send(JSON.stringify({
              type: 'audio_chunk',
              audio: base64,
              format: 'webm',
            }));
            console.log('[Backend] Sent audio chunk', Math.round(base64.length / 1024), 'KB');
          }
        };
        reader.readAsDataURL(event.data);
      }
    };

    recorder.onstop = () => {
      this.recorder = null;
      this.chunkIntervalId = setTimeout(() => this._sendNextChunk(), 0);
    };

    try {
      recorder.start();
    } catch (e) {
      console.error('[Backend] MediaRecorder.start failed:', e);
      this.chunkIntervalId = setTimeout(() => this._sendNextChunk(), AUDIO_CHUNK_INTERVAL_MS);
      return;
    }

    this.recorder = recorder;
    this.chunkIntervalId = setTimeout(() => {
      if (this.recorder && this.recorder.state === 'recording') {
        this.recorder.stop();
      }
    }, AUDIO_CHUNK_INTERVAL_MS);
  }

  _stopRecording() {
    if (this.chunkIntervalId) {
      clearTimeout(this.chunkIntervalId);
      this.chunkIntervalId = null;
    }
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = null;
      this.recorder.stop();
      this.recorder = null;
    }
    this._recordStream = null;
  }

  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop_listening' }));
      this.ws.close();
    }
    this.ws = null;
    if (this._useWebSpeech) this._stopWebSpeech();
    this._stopRecording();
    console.log('[Backend] Stopped');
  }
}
