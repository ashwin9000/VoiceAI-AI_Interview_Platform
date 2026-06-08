/**
 * TTS Service — Browser-native Text-to-Speech
 * 
 * Wraps the Web Speech Synthesis API to speak interview questions aloud.
 * Provides voice selection, queue management, barge-in support, and
 * graceful degradation when speechSynthesis is unavailable.
 */

class TTSService {
  constructor() {
    this._enabled = true;
    this._speaking = false;
    this._voice = null;
    this._voicesLoaded = false;
    this._rate = 1.0;
    this._pitch = 1.0;
    this._volume = 1.0;

    // Callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;

    // Check support
    this._supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

    if (this._supported) {
      this._loadVoices();
      // Chrome loads voices asynchronously
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this._loadVoices();
      });
    } else {
      console.warn('[TTS] speechSynthesis is not supported in this browser.');
    }
  }

  /**
   * Load and select the best available English voice.
   * Prefers high-quality voices from Google/Microsoft.
   */
  _loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    this._voicesLoaded = true;

    // Priority list of preferred voices (high quality)
    const preferredVoices = [
      'Google US English',
      'Google UK English Female',
      'Google UK English Male',
      'Microsoft David',
      'Microsoft Zira',
      'Microsoft Mark',
      'Samantha', // macOS
      'Alex',     // macOS
      'Daniel',   // macOS UK
    ];

    // Try preferred voices first
    for (const name of preferredVoices) {
      const found = voices.find(v => v.name.includes(name));
      if (found) {
        this._voice = found;
        console.log(`[TTS] Selected voice: ${found.name} (${found.lang})`);
        return;
      }
    }

    // Fallback: any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      this._voice = englishVoice;
      console.log(`[TTS] Fallback voice: ${englishVoice.name} (${englishVoice.lang})`);
      return;
    }

    // Last resort: first available voice
    if (voices.length > 0) {
      this._voice = voices[0];
      console.log(`[TTS] Last resort voice: ${voices[0].name} (${voices[0].lang})`);
    }
  }

  /**
   * Whether TTS is supported and enabled.
   */
  get isSupported() {
    return this._supported;
  }

  /**
   * Whether TTS is currently enabled.
   */
  get isEnabled() {
    return this._enabled && this._supported;
  }

  /**
   * Whether the service is currently speaking.
   */
  get isSpeaking() {
    return this._speaking;
  }

  /**
   * Enable or disable TTS.
   */
  setEnabled(enabled) {
    this._enabled = enabled;
    if (!enabled) {
      this.stop();
    }
    console.log(`[TTS] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Toggle TTS on/off. Returns new state.
   */
  toggle() {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /**
   * Speak the given text. Cancels any ongoing speech first.
   * @param {string} text - The text to speak
   * @returns {Promise<void>} Resolves when speech completes or is cancelled
   */
  speak(text) {
    return new Promise((resolve, reject) => {
      if (!this._supported || !this._enabled) {
        resolve();
        return;
      }

      if (!text || !text.trim()) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      this.stop();

      // Chrome has a bug where speechSynthesis.cancel() needs a tick
      // before starting new speech
      setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);

          if (this._voice) {
            utterance.voice = this._voice;
          }
          utterance.rate = this._rate;
          utterance.pitch = this._pitch;
          utterance.volume = this._volume;

          utterance.onstart = () => {
            this._speaking = true;
            this.onStart?.();
          };

          utterance.onend = () => {
            this._speaking = false;
            this.onEnd?.();
            resolve();
          };

          utterance.onerror = (event) => {
            this._speaking = false;
            // 'interrupted' and 'canceled' are expected when stop() is called
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
              console.error('[TTS] Speech error:', event.error);
              this.onError?.(event.error);
              reject(new Error(event.error));
            } else {
              resolve();
            }
          };

          window.speechSynthesis.speak(utterance);

          // Chrome workaround: speechSynthesis sometimes pauses after ~15s.
          // Keep it alive by resuming periodically.
          this._keepAliveInterval = setInterval(() => {
            if (window.speechSynthesis.speaking) {
              window.speechSynthesis.pause();
              window.speechSynthesis.resume();
            } else {
              clearInterval(this._keepAliveInterval);
            }
          }, 10000);
        } catch (err) {
          console.error('[TTS] Failed to speak:', err);
          this._speaking = false;
          resolve();
        }
      }, 50);
    });
  }

  /**
   * Immediately stop any ongoing speech.
   * Used for barge-in when the user starts recording.
   */
  stop() {
    if (!this._supported) return;

    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }

    window.speechSynthesis.cancel();
    this._speaking = false;
  }

  /**
   * Clean up resources.
   */
  destroy() {
    this.stop();
    this.onStart = null;
    this.onEnd = null;
    this.onError = null;
  }
}

// Singleton instance
const ttsService = new TTSService();
export default ttsService;
