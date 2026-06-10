/**
 * VAD Service — Voice Activity Detection using @ricky0123/vad-web (Silero VAD)
 *
 * Runs Silero VAD locally in the browser to detect speech activity.
 * Provides callbacks for speech start/end.
 *
 * The VAD is a pure speech detector — it does NOT interact with TTS.
 * TTS coordination (pausing/resuming VAD) is handled by the parent component.
 *
 * Uses the same microphone MediaStream as AssemblyAI (no duplicate mic access).
 */

import { MicVAD } from '@ricky0123/vad-web';

// ─── Configuration ──────────────────────────────────────────

const VAD_CONFIG = {
  // Silero VAD thresholds
  positiveSpeechThreshold: 0.55,   // Confidence to classify as speech
  negativeSpeechThreshold: 0.35,   // Confidence to classify as silence
};

export class VADService {
  constructor() {
    this._vad = null;
    this._initialized = false;
    this._initializing = false;
    this._paused = false;
    this._isSpeaking = false;           // Whether user is currently speaking

    // Callbacks
    this.onSpeechStart = null;          // () => void — speech started
    this.onSpeechEnd = null;            // (audio: Float32Array) => void — speech ended
    this.onVADMisfire = null;           // () => void — false positive detected
  }

  // ─── Public Getters ───────────────────────────────────────

  get isInitialized() {
    return this._initialized;
  }

  get isSpeaking() {
    return this._isSpeaking;
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /**
   * Initialize VAD with Silero model.
   * @param {MediaStream} stream - The microphone MediaStream (shared with AssemblyAI)
   * @returns {Promise<boolean>} true if initialized successfully
   */
  async init(stream) {
    if (this._initialized || this._initializing) {
      console.warn('[VAD] Already initialized or initializing.');
      return this._initialized;
    }

    this._initializing = true;

    try {
      const sharedStream = stream;

      this._vad = await MicVAD.new({
        // Use shared stream
        getStream: async () => sharedStream,

        // Override pause/resume to NOT stop tracks (stream is shared with AssemblyAI)
        pauseStream: async (_stream) => {},
        resumeStream: async (_stream) => sharedStream,

        // Silero VAD options
        positiveSpeechThreshold: VAD_CONFIG.positiveSpeechThreshold,
        negativeSpeechThreshold: VAD_CONFIG.negativeSpeechThreshold,

        // Serve ONNX model and worklet from CDN
        onnxWASMBasePath:
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/",
        baseAssetPath:
        "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/",

        // Use the legacy model (smaller, well-tested)
        model: 'legacy',

        // Don't auto-start — we'll call start() explicitly
        startOnLoad: false,

        // Callbacks
        onSpeechStart: () => {
          if (this._paused) return;
          this._isSpeaking = true;
          console.log('[VAD] Speech started.', performance.now().toFixed(1));
          this.onSpeechStart?.();
        },

        onSpeechEnd: (audio) => {
          if (this._paused) return;
          this._isSpeaking = false;
          console.log('[VAD] Speech ended.');
          this.onSpeechEnd?.(audio);
        },

        onVADMisfire: () => {
          console.log('[VAD] Misfire (false positive).');
          this.onVADMisfire?.();
        },
      });
      console.log("[VAD] MicVAD.new() succeeded");

      // Start VAD listening
      await this._vad.start();
      console.log("[VAD] start() succeeded");
      this._initialized = true;
      this._initializing = false;

      console.log('[VAD] Initialized — Silero VAD active.');
      return true;
    } catch (err) {
      console.error('[VAD] Initialization failed:', err);
      this._initializing = false;
      return false;
    }
  }

  /**
   * Destroy VAD and release resources.
   */
  async destroy() {
    if (this._vad) {
      try {
        await this._vad.destroy();
      } catch (err) {
        console.warn('[VAD] Error during destroy:', err);
      }
      this._vad = null;
    }

    this._initialized = false;
    this._initializing = false;
    this._isSpeaking = false;
    this._paused = false;

    console.log('[VAD] Destroyed.');
  }

  /**
   * Pause VAD processing (e.g., while TTS is speaking).
   */
  async pause() {
    if (this._vad && this._initialized && !this._paused) {
      await this._vad.pause();
      this._paused = true;
      this._isSpeaking = false;
      console.log('[VAD] Paused.');
    }
  }

  /**
   * Resume VAD processing (e.g., after TTS finishes).
   */
  async resume() {
    if (this._vad && this._initialized && this._paused) {
      await this._vad.start();
      this._paused = false;
      console.log('[VAD] Resumed.');
    }
  }
}

export default VADService;
