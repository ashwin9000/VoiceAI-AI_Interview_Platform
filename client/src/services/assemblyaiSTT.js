/**
 * AssemblyAI Streaming v3 — Real-time Speech-to-Text Service
 * 
 * Connects to AssemblyAI's streaming WebSocket endpoint via temporary tokens.
 * Captures microphone audio, converts to 16kHz PCM16LE, and sends in 50ms chunks.
 * Receives Turn events with partial and final transcripts.
 * 
 * Falls back gracefully when AssemblyAI is unavailable.
 */

const ASSEMBLYAI_WS_URL = 'wss://streaming.assemblyai.com/v3/ws';
const SAMPLE_RATE = 16000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class AssemblyAISTT {
  constructor() {
    this._ws = null;
    this._audioContext = null;
    this._mediaStream = null;
    this._workletNode = null;
    this._connected = false;
    this._connecting = false;
    this._retryCount = 0;
    this._terminated = false;

    // Accumulated transcript state
    this._finalTranscript = '';
    this._partialTranscript = '';

    // Callbacks
    this.onTranscript = null;      // (fullText, isFinal) => void
    this.onSessionStart = null;    // () => void
    this.onSessionEnd = null;      // () => void
    this.onError = null;           // (error) => void
    this.onFallbackNeeded = null;  // () => void — signal to use Web Speech API
  }

  /**
   * Whether the service is currently connected and streaming.
   */
  get isConnected() {
    return this._connected;
  }

  /**
   * Whether a connection attempt is in progress.
   */
  get isConnecting() {
    return this._connecting;
  }

  /**
   * Fetch a temporary token from our backend.
   */
  async _fetchToken() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/assemblyai/token', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Token request failed: ${response.status}`);
      }

      const data = await response.json();
      return data.data.token;
    } catch (err) {
      console.error('[AssemblyAI STT] Token fetch failed:', err.message);
      throw err;
    }
  }

  /**
   * Connect to AssemblyAI Streaming v3 and start capturing microphone audio.
   * @returns {Promise<boolean>} true if connected, false if fallback needed
   */
  async connect() {
    if (this._connected || this._connecting) {
      console.warn('[AssemblyAI STT] Already connected or connecting.');
      return true;
    }

    this._connecting = true;
    this._terminated = false;

    try {
      // Step 1: Get temporary token
      const tempToken = await this._fetchToken();

      // Step 2: Open WebSocket
      const wsUrl = `${ASSEMBLYAI_WS_URL}?token=${encodeURIComponent(tempToken)}&speech_model=u3-rt-pro&sample_rate=${SAMPLE_RATE}&format_turns=true`;

      await this._openWebSocket(wsUrl);

      // Step 3: Start microphone capture
      await this._startMicrophone();

      this._connected = true;
      this._connecting = false;
      this._retryCount = 0;

      console.log('[AssemblyAI STT] Connected and streaming.');
      return true;
    } catch (err) {
      console.error('[AssemblyAI STT] Connection failed:', err.message);
      this._connecting = false;

      // Retry with exponential backoff
      if (this._retryCount < MAX_RETRIES && !this._terminated) {
        this._retryCount++;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, this._retryCount - 1);
        console.log(`[AssemblyAI STT] Retrying in ${delay}ms (attempt ${this._retryCount}/${MAX_RETRIES})...`);
        await new Promise(r => setTimeout(r, delay));
        return this.connect();
      }

      // All retries exhausted — signal fallback
      console.warn('[AssemblyAI STT] All retries exhausted. Signaling fallback.');
      this.onFallbackNeeded?.();
      return false;
    }
  }

  /**
   * Open WebSocket connection to AssemblyAI.
   */
  _openWebSocket(url) {
    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timed out'));
          this._ws?.close();
        }, 10000);

        this._ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[AssemblyAI STT] WebSocket opened.');
        };

        this._ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this._handleMessage(msg);

            // Resolve on Begin message (session started)
            if (msg.type === 'Begin') {
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            console.error('[AssemblyAI STT] Failed to parse message:', err);
          }
        };

        this._ws.onerror = (event) => {
          console.error('[AssemblyAI STT] WebSocket error:', event);
          clearTimeout(timeout);
          reject(new Error('WebSocket connection error'));
        };

        this._ws.onclose = (event) => {
          console.log(`[AssemblyAI STT] WebSocket closed: code=${event.code} reason=${event.reason}`);
          clearTimeout(timeout);
          this._connected = false;

          // Handle unexpected closure
          if (!this._terminated && this._connected) {
            this.onError?.(new Error(`Connection lost (code: ${event.code})`));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages from AssemblyAI.
   */
  _handleMessage(msg) {
    switch (msg.type) {
      case 'Begin':
        console.log(`[AssemblyAI STT] Session started: ${msg.id}`);
        this.onSessionStart?.();
        break;

      case 'Turn':
        this._handleTurn(msg);
        break;

      case 'Termination':
        console.log('[AssemblyAI STT] Session terminated by server.');
        this.onSessionEnd?.();
        break;

      case 'SpeechStarted':
        // VAD detected speech — could be used for UI feedback
        break;

      default:
        console.log('[AssemblyAI STT] Unknown message type:', msg.type);
    }
  }

  /**
   * Handle Turn messages — contains transcript text.
   */
  _handleTurn(msg) {
    const transcript = msg.transcript || '';
    const isEndOfTurn = msg.end_of_turn === true;

    if (!transcript.trim()) return;

    if (isEndOfTurn) {
      // Final turn — append to accumulated final transcript
      this._finalTranscript += (this._finalTranscript ? ' ' : '') + transcript.trim();
      this._partialTranscript = '';
      this.onTranscript?.(this._finalTranscript, true);
    } else {
      // Partial turn — show as interim result
      this._partialTranscript = transcript.trim();
      const combined = this._finalTranscript
        ? this._finalTranscript + ' ' + this._partialTranscript
        : this._partialTranscript;
      this.onTranscript?.(combined, false);
    }
  }

  /**
   * Start capturing microphone audio and sending to AssemblyAI.
   */
  async _startMicrophone() {
    // Request microphone access with echo cancellation
    this._mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,  // AssemblyAI handles noise server-side
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
      },
    });

    // Create AudioContext at 16kHz
    this._audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: SAMPLE_RATE,
    });

    const source = this._audioContext.createMediaStreamSource(this._mediaStream);

    // Try AudioWorklet first, fall back to ScriptProcessor
    try {
      await this._audioContext.audioWorklet.addModule('/pcm-processor.js');
      this._workletNode = new AudioWorkletNode(this._audioContext, 'pcm-processor');

      this._workletNode.port.onmessage = (event) => {
        if (this._ws?.readyState === WebSocket.OPEN) {
          this._ws.send(event.data);
        }
      };

      source.connect(this._workletNode);
      this._workletNode.connect(this._audioContext.destination);
      console.log('[AssemblyAI STT] Using AudioWorklet for audio capture.');
    } catch (err) {
      console.warn('[AssemblyAI STT] AudioWorklet not available, using ScriptProcessor:', err.message);
      this._useScriptProcessor(source);
    }
  }

  /**
   * Fallback: Use deprecated ScriptProcessorNode for browsers
   * that don't support AudioWorklet.
   */
  _useScriptProcessor(source) {
    // Buffer size of 4096 at 16kHz ≈ 256ms chunks
    const processor = this._audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      if (this._ws?.readyState !== WebSocket.OPEN) return;

      const float32Data = event.inputBuffer.getChannelData(0);
      const int16Data = new Int16Array(float32Data.length);

      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this._ws.send(int16Data.buffer);
    };

    source.connect(processor);
    processor.connect(this._audioContext.destination);
    this._scriptProcessor = processor;
  }

  /**
   * Get the current accumulated transcript.
   */
  getTranscript() {
    if (this._partialTranscript) {
      return this._finalTranscript
        ? this._finalTranscript + ' ' + this._partialTranscript
        : this._partialTranscript;
    }
    return this._finalTranscript;
  }

  /**
   * Clear the accumulated transcript (e.g., when moving to next question).
   */
  clearTranscript() {
    this._finalTranscript = '';
    this._partialTranscript = '';
  }

  /**
   * Gracefully stop streaming and disconnect.
   */
  async disconnect() {
    this._terminated = true;

    // Send terminate message to AssemblyAI
    if (this._ws?.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify({ type: 'Terminate' }));
        // Wait briefly for termination ack
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.warn('[AssemblyAI STT] Error sending terminate:', err.message);
      }
    }

    // Close WebSocket
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }

    // Stop microphone
    this._stopMicrophone();

    this._connected = false;
    this._connecting = false;
    console.log('[AssemblyAI STT] Disconnected.');
  }

  /**
   * Stop microphone capture and release audio resources.
   */
  _stopMicrophone() {
    if (this._workletNode) {
      this._workletNode.disconnect();
      this._workletNode = null;
    }

    if (this._scriptProcessor) {
      this._scriptProcessor.disconnect();
      this._scriptProcessor = null;
    }

    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = null;
    }

    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop());
      this._mediaStream = null;
    }
  }

  /**
   * Clean up all resources.
   */
  destroy() {
    this.disconnect();
    this.onTranscript = null;
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.onError = null;
    this.onFallbackNeeded = null;
  }
}

export default AssemblyAISTT;
