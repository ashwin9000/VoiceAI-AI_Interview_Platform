/**
 * PCM Audio Processor Worklet
 * 
 * Captures raw audio from the microphone, converts Float32 samples to
 * Int16 PCM (little-endian), buffers into ~50ms chunks, and posts each
 * chunk back to the main thread as an ArrayBuffer.
 * 
 * Used by AssemblyAI Streaming v3 which expects 16kHz PCM16LE audio
 * in 50ms chunks (800 samples per chunk at 16kHz).
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(0);
    // 50ms at 16kHz = 800 samples per chunk
    this._chunkSize = 800;
  }

  /**
   * Convert Float32 audio samples to Int16 PCM.
   * Clamps values to [-1, 1] range before conversion.
   */
  _float32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    // Convert Float32 to Int16 PCM
    const pcmData = this._float32ToInt16(input[0]);

    // Append to buffer
    const newBuffer = new Int16Array(this._buffer.length + pcmData.length);
    newBuffer.set(this._buffer);
    newBuffer.set(pcmData, this._buffer.length);
    this._buffer = newBuffer;

    // Send complete chunks
    while (this._buffer.length >= this._chunkSize) {
      const chunk = this._buffer.slice(0, this._chunkSize);
      this._buffer = this._buffer.slice(this._chunkSize);
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
