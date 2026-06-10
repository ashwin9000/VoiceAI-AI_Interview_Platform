/**
 * AssemblyAI Streaming v3 — Persistent Real-time Speech-to-Text Service
 *
 * Architecture: ONE connection per interview session.
 * - init()           → fetch token, open WebSocket, acquire microphone (called once on mount)
 * - startStreaming()  → begin forwarding PCM audio to WebSocket (called by VAD onSpeechStart)
 * - stopStreaming()   → stop forwarding audio but keep WS open (called by VAD onSpeechEnd)
 * - destroy()         → graceful shutdown: Terminate WS, release mic (called on unmount)
 *
 * Audio is always captured by the AudioWorklet; the `_sendingAudio` flag gates
 * whether chunks are forwarded to the WebSocket.
 */

const ASSEMBLYAI_WS_URL = 'wss://streaming.assemblyai.com/v3/ws';
const SAMPLE_RATE = 16000;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

// Pre-roll buffer: keep last N chunks so we can recover audio before VAD fires.
// At 16kHz with 50ms chunks (800 samples each), 6 chunks = 300ms.
const PRE_ROLL_CHUNKS = 6;

export class AssemblyAISTT {
  constructor() {
    this._ws = null;
    this._audioContext = null;
    this._mediaStream = null;
    this._workletNode = null;
    this._scriptProcessor = null;
    this._ownsStream = false; // true if we acquired the mic, false if shared

    // Connection state
    this._initialized = false;
    this._initializing = false;
    this._sendingAudio = false;
    this._terminated = false;
    this._reconnectAttempts = 0;

    // Pre-roll ring buffer — stores recent audio chunks so the first word
    // isn't lost when VAD fires after speech has already begun.
    this._preRollBuffer = [];

    // Accumulated transcript state
    this._finalTranscript = '';
    this._partialTranscript = '';

    // Callbacks
    this.onTranscript = null;      // (fullText, isFinal) => void
    this.onSessionStart = null;    // () => void
    this.onSessionEnd = null;      // () => void
    this.onError = null;           // (error) => void
    this.onFallbackNeeded = null;  // () => void — signal to use Web Speech API
    this.onConnectionStateChange = null; // (state: 'connecting'|'connected'|'reconnecting'|'disconnected') => void
  }

  // ─── Public Getters ────────────────────────────────────────

  /** Whether the service is initialized and the WebSocket is open. */
  get isConnected() {
    return this._initialized && this._ws?.readyState === WebSocket.OPEN;
  }

  /** Whether initialization is in progress. */
  get isInitializing() {
    return this._initializing;
  }

  /** Whether audio is currently being streamed to AssemblyAI. */
  get isStreaming() {
    return this._sendingAudio;
  }

  // ─── Lifecycle: Init (called once on mount) ────────────────

  /**
   * Initialize the persistent connection.
   * Acquires microphone, loads AudioWorklet, fetches token, opens WebSocket.
   * @param {MediaStream} [sharedStream] - Optional pre-acquired MediaStream to share with VAD
   * @returns {Promise<boolean>} true if connected, false if fallback needed
   */
  async init(sharedStream = null) {
    if (this._initialized || this._initializing) {
      console.warn('[AssemblyAI STT] Already initialized or initializing.');
      return this._initialized;
    }

    this._initializing = true;
    this._terminated = false;
    this.onConnectionStateChange?.('connecting');

    try {
      // Step 1: Acquire microphone (or use shared stream)
      if (sharedStream) {
        this._mediaStream = sharedStream;
        this._ownsStream = false;
        console.log('[AssemblyAI STT] Using shared MediaStream.');
      } else {
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // AssemblyAI handles noise server-side
            sampleRate: SAMPLE_RATE,
            channelCount: 1,
          },
        });
        this._ownsStream = true;
        console.log('[AssemblyAI STT] Microphone acquired.');
      }

      // Step 2: Set up AudioContext and Worklet (persistent)
      await this._setupAudioPipeline();

      // Step 3: Fetch token + open WebSocket
      await this._connectWebSocket();

      this._initialized = true;
      this._initializing = false;
      this._reconnectAttempts = 0;
      this.onConnectionStateChange?.('connected');

      console.log('[AssemblyAI STT] Initialized — persistent connection established.');
      return true;
    } catch (err) {
      console.error('[AssemblyAI STT] Initialization failed:', err.message);
      this._initializing = false;
      this.onConnectionStateChange?.('disconnected');
      this.onFallbackNeeded?.();
      return false;
    }
  }

  // ─── Audio Gating (called by VAD) ─────────────────────────

  /**
   * Start forwarding audio chunks to AssemblyAI.
   * Called when VAD detects speech start.
   */
  startStreaming() {
    if (!this._initialized) {
      console.warn('[AssemblyAI STT] Cannot start streaming — not initialized.');
      return;
    }

    // Flush pre-roll buffer: send buffered audio BEFORE switching to live.
    // This recovers ~300ms of audio that was captured before VAD triggered.
    if (this._preRollBuffer.length > 0 && this._ws?.readyState === WebSocket.OPEN) {
      console.log(`[AssemblyAI STT] Flushing ${this._preRollBuffer.length} pre-roll chunks (${this._preRollBuffer.length * 50}ms).`);
      for (const chunk of this._preRollBuffer) {
        this._ws.send(chunk);
      }
      this._preRollBuffer = [];
    }

    this._sendingAudio = true;
    console.log('[AssemblyAI STT] START STREAMING', performance.now().toFixed(1));
  }

  /**
   * Stop forwarding audio chunks to AssemblyAI.
   * WebSocket stays open, microphone stays on.
   * Called when VAD detects speech end.
   */
  stopStreaming() {
    this._sendingAudio = false;
    console.log('[AssemblyAI STT] Audio streaming paused (connection kept alive).');
  }

  // ─── Transcript Management ────────────────────────────────

  /** Get the current accumulated transcript. */
  getTranscript() {
    if (this._partialTranscript) {
      return this._finalTranscript
        ? this._finalTranscript + ' ' + this._partialTranscript
        : this._partialTranscript;
    }
    return this._finalTranscript;
  }

  /** Clear the accumulated transcript (e.g., when moving to next question). */
  clearTranscript() {
    this._finalTranscript = '';
    this._partialTranscript = '';
  }

  /**
   * Prepend previously accumulated text (for question transitions).
   */
  prependTranscript(text) {
    if (text) {
      this._finalTranscript = text.trim();
    }
  }

  // ─── Lifecycle: Destroy (called once on unmount) ──────────

  /**
   * Gracefully shut down everything.
   * Sends Terminate to AssemblyAI, closes WebSocket, releases microphone.
   */
  async destroy() {
    this._terminated = true;
    this._sendingAudio = false;

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

    // Release audio resources
    this._teardownAudioPipeline();

    this._initialized = false;
    this._initializing = false;
    this.onConnectionStateChange?.('disconnected');

    console.log('[AssemblyAI STT] Destroyed — all resources released.');
  }

  /**
   * Clean up all resources and nullify callbacks.
   */
  destroyFull() {
    this.destroy();
    this.onTranscript = null;
    this.onSessionStart = null;
    this.onSessionEnd = null;
    this.onError = null;
    this.onFallbackNeeded = null;
    this.onConnectionStateChange = null;
  }

  // ─── Internal: WebSocket ──────────────────────────────────

  async _connectWebSocket() {
    const tempToken = await this._fetchToken();
    const wsUrl = `${ASSEMBLYAI_WS_URL}?token=${encodeURIComponent(tempToken)}&speech_model=u3-rt-pro&sample_rate=${SAMPLE_RATE}&format_turns=true&interruption_delay=100`;
    await this._openWebSocket(wsUrl);
  }

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

          // Handle unexpected closure — attempt reconnect
          if (!this._terminated && this._initialized) {
            this._initialized = false;
            this._sendingAudio = false;
            this.onError?.(new Error(`Connection lost (code: ${event.code})`));
            this._attemptReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async _attemptReconnect() {
    if (this._terminated || this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[AssemblyAI STT] Reconnect attempts exhausted. Signaling fallback.');
      this.onFallbackNeeded?.();
      return;
    }

    this._reconnectAttempts++;
    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, this._reconnectAttempts - 1);
    console.log(`[AssemblyAI STT] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    this.onConnectionStateChange?.('reconnecting');

    await new Promise(r => setTimeout(r, delay));

    if (this._terminated) return;

    try {
      await this._connectWebSocket();
      this._initialized = true;
      this._reconnectAttempts = 0;
      this.onConnectionStateChange?.('connected');
      console.log('[AssemblyAI STT] Reconnected successfully.');
    } catch (err) {
      console.error('[AssemblyAI STT] Reconnect failed:', err.message);
      this._attemptReconnect();
    }
  }

  // ─── Internal: Message Handling ───────────────────────────

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
        // AssemblyAI's own VAD detected speech — informational only
        break;

      default:
        console.log('[AssemblyAI STT] Unknown message type:', msg.type);
    }
  }

  _handleTurn(msg) {
    const transcript = msg.transcript || '';
    const isEndOfTurn = msg.end_of_turn === true;

    console.log(`[AssemblyAI STT] TURN ${isEndOfTurn ? 'FINAL' : 'partial'}`, performance.now().toFixed(1), `"${transcript.slice(0, 60)}"`);

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

  // ─── Internal: Audio Pipeline ─────────────────────────────

  async _setupAudioPipeline() {
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
        if (this._sendingAudio && this._ws?.readyState === WebSocket.OPEN) {
          // Live streaming — send directly
          this._ws.send(event.data);
        } else {
          // Not streaming — buffer for pre-roll recovery
          this._preRollBuffer.push(event.data);
          if (this._preRollBuffer.length > PRE_ROLL_CHUNKS) {
            this._preRollBuffer.shift(); // Drop oldest, keep last N
          }
        }
      };

      source.connect(this._workletNode);
      this._workletNode.connect(this._audioContext.destination);
      console.log('[AssemblyAI STT] AudioWorklet pipeline established.');
    } catch (err) {
      console.warn('[AssemblyAI STT] AudioWorklet not available, using ScriptProcessor:', err.message);
      this._useScriptProcessor(source);
    }
  }

  _useScriptProcessor(source) {
    const processor = this._audioContext.createScriptProcessor(2048, 1, 1);

    processor.onaudioprocess = (event) => {
      const float32Data = event.inputBuffer.getChannelData(0);
      const int16Data = new Int16Array(float32Data.length);

      for (let i = 0; i < float32Data.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Data[i]));
        int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      if (this._sendingAudio && this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(int16Data.buffer);
      } else {
        // Pre-roll buffer for ScriptProcessor fallback
        this._preRollBuffer.push(int16Data.buffer);
        if (this._preRollBuffer.length > PRE_ROLL_CHUNKS) {
          this._preRollBuffer.shift();
        }
      }
    };

    source.connect(processor);
    processor.connect(this._audioContext.destination);
    this._scriptProcessor = processor;
  }

  _teardownAudioPipeline() {
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

    // Only stop tracks if we own the stream (not shared)
    if (this._mediaStream) {
      if (this._ownsStream) {
        this._mediaStream.getTracks().forEach(track => track.stop());
      }
      this._mediaStream = null;
    }
  }

  /**
   * Returns the current MediaStream (for sharing with VAD).
   */
  getMediaStream() {
    return this._mediaStream;
  }
}

export default AssemblyAISTT;
