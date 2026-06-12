import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
// import "onnxruntime-web";
import { Mic, MicOff, Type, Wifi, WifiOff, Loader2, Radio, AudioLines } from 'lucide-react';
import { AssemblyAISTT } from '../services/assemblyaiSTT';
import { VADService } from '../services/vadService';
import ttsService from '../services/ttsService';

/**
 * VoiceRecorder — Automatic Voice Activity Detection (VAD) speech input.
 *
 * Uses Silero VAD (@ricky0123/vad-web) to automatically detect speech,
 * then streams audio to AssemblyAI Streaming v3 for real-time transcription.
 *
 * No spacebar or manual controls needed — the user simply speaks.
 *
 * Architecture:
 *   - Persistent AssemblyAI WebSocket connection (established once on mount)
 *   - VAD gates audio forwarding (only sends audio when user is speaking)
 *   - VAD is PAUSED while TTS is speaking (no automatic barge-in)
 *   - User controls TTS via explicit "Stop Speaking" buttons in the parent
 *
 * Falls back to browser Web Speech API, then text input if unavailable.
 *
 * Props:
 *   onTranscript(text)             — called with the accumulated transcript text
 *   disabled                       — disables all input
 *   onSpeechActivity(isSpeaking)   — called when VAD detects speech start/end
 *   isTTSSpeaking                  — true when TTS is currently playing (pauses VAD)
 */
const VoiceRecorder = forwardRef(({ onTranscript, disabled = false, onSpeechActivity, isTTSSpeaking = false }, ref) => {
  const [transcript, setTranscript] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [sttProvider, setSttProvider] = useState('none'); // 'assemblyai' | 'webspeech' | 'text' | 'none'

  // Connection states
  const [connectionState, setConnectionState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  const [connectionError, setConnectionError] = useState(null);

  // VAD states
  const [vadState, setVadState] = useState('idle'); // 'idle' | 'listening' | 'speaking'

  // Refs
  const assemblyaiRef = useRef(null);
  const vadRef = useRef(null);
  const recognitionRef = useRef(null);
  const accumulatedTextRef = useRef('');
  const textareaRef = useRef(null);
  const mountedRef = useRef(true);
  const mediaStreamRef = useRef(null);
  const isTTSSpeakingRef = useRef(isTTSSpeaking);

  // Keep ref in sync with prop so setTimeout closures see the latest value
  useEffect(() => {
    isTTSSpeakingRef.current = isTTSSpeaking;
  }, [isTTSSpeaking]);

  // ──────────────────────────────────────────────
  // Initialize AssemblyAI + VAD (once on mount)
  // ──────────────────────────────────────────────

  useEffect(() => {
    // Per-invocation cancellation flag — prevents React StrictMode's double-mount
    // from running two init pipelines concurrently. Unlike mountedRef (a shared ref
    // that mount #2 sets back to true), this stays true for mount #1's closure.
    let cancelled = false;

    const initPipeline = async () => {
      // Token availability check removed — it consumed a real single-use token
      // just to verify the endpoint. stt.init() handles failure and triggers fallback.
      if (cancelled) return;

      setSttProvider('assemblyai');
      setConnectionState('connecting');

      // Step 2: Acquire microphone once
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            sampleRate: 16000,
            channelCount: 1,
          },
        });
      } catch (err) {
        console.error('[VoiceRecorder] Microphone access denied:', err.message);
        if (!cancelled) fallbackToWebSpeech();
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      mediaStreamRef.current = stream;

      // Step 3: Initialize AssemblyAI with shared stream
      const stt = new AssemblyAISTT();

      stt.onTranscript = (text, isFinal) => {
        if (cancelled) return;
        console.log(`[VoiceRecorder] TRANSCRIPT ${isFinal ? 'FINAL' : 'partial'}`, performance.now().toFixed(1), `"${text.slice(-50)}"`);
        setTranscript(text);
        onTranscript?.(text);
      };

      stt.onError = (error) => {
        console.error('[VoiceRecorder] AssemblyAI error:', error);
        if (!cancelled) {
          setConnectionError(error.message || 'Connection error');
        }
      };

      stt.onFallbackNeeded = () => {
        console.warn('[VoiceRecorder] AssemblyAI unavailable — falling back.');
        if (!cancelled) {
          cleanupVAD();
          fallbackToWebSpeech();
        }
      };

      stt.onConnectionStateChange = (state) => {
        if (cancelled) return;
        if (state === 'connected') {
          setConnectionState('connected');
          setConnectionError(null);
        } else if (state === 'reconnecting') {
          setConnectionState('reconnecting');
        } else if (state === 'disconnected') {
          setConnectionState('error');
        }
      };

      stt.onSessionStart = () => {
        if (!cancelled) {
          setConnectionState('connected');
          setConnectionError(null);
        }
      };

      assemblyaiRef.current = stt;

      // Initialize persistent connection
      const connected = await stt.init(stream);

      if (cancelled) {
        // This invocation was cancelled (StrictMode unmount) — clean up
        stt.destroyFull();
        stream.getTracks().forEach(t => t.stop());
        assemblyaiRef.current = null;
        mediaStreamRef.current = null;
        return;
      }

      if (!connected) {
        fallbackToWebSpeech();
        return;
      }

      // Step 4: Initialize VAD with same stream
      const vad = new VADService();

      vad.onSpeechStart = () => {
        if (cancelled) return;
        console.log('[VoiceRecorder] VAD → Speech started → streaming audio.', performance.now().toFixed(1));
        setVadState('speaking');
        onSpeechActivity?.(true);

        // Start forwarding audio to AssemblyAI
        assemblyaiRef.current?.startStreaming();
      };

      vad.onSpeechEnd = () => {
        if (cancelled) return;
        console.log('[VoiceRecorder] VAD → Speech ended → pausing stream.');
        setVadState('listening');
        onSpeechActivity?.(false);

        // Stop forwarding audio (WebSocket stays open)
        assemblyaiRef.current?.stopStreaming();
      };

      vadRef.current = vad;

      const vadInitialized = await vad.init(stream);

      if (!vadInitialized) {
        console.warn('[VoiceRecorder] VAD initialization failed — continuing with manual mode.');
      }

      if (cancelled) {
        vad.destroy();
        stt.destroyFull();
        stream.getTracks().forEach(t => t.stop());
        vadRef.current = null;
        assemblyaiRef.current = null;
        mediaStreamRef.current = null;
        return;
      }

      // If TTS is currently speaking, start VAD in paused state.
      // It will be resumed when isTTSSpeaking prop becomes false.
      if (ttsService.isSpeaking) {
        console.log('[VoiceRecorder] TTS is speaking — starting VAD paused.');
        await vad.pause();
        setVadState('idle');
      } else {
        setVadState('listening');
      }
    };

    const fallbackToWebSpeech = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSttProvider('webspeech');
        setConnectionState('connected');
        console.log('[VoiceRecorder] Using Web Speech API (fallback).');
      } else {
        setSttProvider('text');
        setUseTextInput(true);
        setConnectionState('connected');
        console.log('[VoiceRecorder] Using text input (no voice support).');
      }
    };

    const cleanupVAD = () => {
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
    };

    initPipeline();

    // Cleanup on unmount
    return () => {
      cancelled = true;

      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }

      if (assemblyaiRef.current) {
        assemblyaiRef.current.destroyFull();
        assemblyaiRef.current = null;
      }

      // Stop mic tracks if we own them
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentionally no deps — init once on mount, destroy on unmount

  // ──────────────────────────────────────────────
  // VAD ↔ TTS / disabled / text-mode coordination
  //
  // Single source of truth: pause VAD whenever ANY inhibiting condition
  // is active (TTS speaking, component disabled, text-input mode).
  // Resume only when ALL conditions are clear.
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (!vadRef.current) return;

    const shouldPause = isTTSSpeaking || disabled || useTextInput;

    if (shouldPause) {
      vadRef.current.pause();
      assemblyaiRef.current?.stopStreaming();
      setVadState('idle');
      if (isTTSSpeaking) {
        console.log('[VoiceRecorder] TTS speaking — VAD paused.');
      }
    } else {
      vadRef.current.resume();
      setVadState('listening');
      console.log('[VoiceRecorder] VAD resumed (TTS idle, enabled, voice mode).');
    }
  }, [isTTSSpeaking, disabled, useTextInput]);

  // ──────────────────────────────────────────────
  // Web Speech API Fallback (unchanged)
  // ──────────────────────────────────────────────

  const initWebSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const previousText = accumulatedTextRef.current;
    let sessionFinalTranscript = '';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          sessionFinalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      const combined = (previousText + sessionFinalTranscript + interimTranscript).trim();
      setTranscript(combined);
      onTranscript?.(combined);
    };

    recognition.onerror = (event) => {
      console.error('[VoiceRecorder] Web Speech error:', event.error);
      if (event.error === 'not-allowed') {
        setSttProvider('text');
        setUseTextInput(true);
      }
      if (sessionFinalTranscript) {
        accumulatedTextRef.current = (previousText + sessionFinalTranscript).trim() + ' ';
      }
    };

    recognition.onend = () => {
      accumulatedTextRef.current = (previousText + sessionFinalTranscript).trim() + ' ';
    };

    return recognition;
  }, [onTranscript]);

  // ──────────────────────────────────────────────
  // Expose clearTranscript to parent via ref
  // ──────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    clearTranscript: () => {
      setTranscript('');
      accumulatedTextRef.current = '';
      onTranscript?.('');
      if (assemblyaiRef.current) {
        // Stop forwarding audio BEFORE clearing so no in-flight chunks
        // generate Turn messages that re-populate the answer box.
        assemblyaiRef.current.stopStreaming();
        assemblyaiRef.current.clearTranscript();
      }
      // Briefly pause then resume VAD to flush its internal speech state,
      // preventing an immediate onSpeechStart from resuming the old stream.
      if (vadRef.current) {
        vadRef.current.pause();
        setVadState('idle');
        // Resume after the grace window so the user can keep speaking.
        // BUT: if TTS has started (or is about to start) speaking, do NOT
        // resume — the isTTSSpeaking effect will handle resuming VAD when
        // TTS ends. We check both the service singleton AND the React prop
        // (via ref) to cover the full race window.
        setTimeout(() => {
          if (vadRef.current && !useTextInput && !ttsService.isSpeaking && !isTTSSpeakingRef.current) {
            vadRef.current.resume();
            setVadState('listening');
          }
        }, 150);
      }
    },
    toggleInputMode: () => {
      setUseTextInput((prev) => !prev);
    },
    get isTextMode() {
      return useTextInput;
    },
  }), [onTranscript, useTextInput]);

  // ──────────────────────────────────────────────
  // Text input handlers
  // ──────────────────────────────────────────────

  const handleTextChange = (e) => {
    setTranscript(e.target.value);
    onTranscript?.(e.target.value);
  };

  const toggleInputMode = () => {
    setUseTextInput(!useTextInput);
  };

  // ──────────────────────────────────────────────
  // Provider badge
  // ──────────────────────────────────────────────

  const getProviderBadge = () => {
    if (useTextInput) return null;

    switch (sttProvider) {
      case 'assemblyai':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Wifi className="w-2.5 h-2.5" />
            AssemblyAI
          </span>
        );
      case 'webspeech':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Mic className="w-2.5 h-2.5" />
            Browser STT
          </span>
        );
      default:
        return null;
    }
  };

  // ──────────────────────────────────────────────
  // VAD Status Indicator
  // ──────────────────────────────────────────────

  const getVADIndicator = () => {
    if (useTextInput || sttProvider !== 'assemblyai') return null;

    if (connectionState === 'connecting') {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-[#000666] animate-spin" />
          <span className="text-sm text-[#767683] font-medium">Initializing...</span>
        </div>
      );
    }

    if (connectionState === 'reconnecting') {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
          <span className="text-sm text-amber-600 font-medium">Reconnecting...</span>
        </div>
      );
    }

    if (connectionState === 'error') {
      return (
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
          <span className="text-sm text-red-600 font-medium">Disconnected</span>
        </div>
      );
    }

    switch (vadState) {
      case 'speaking':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="absolute w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75" />
            </div>
            <span className="text-sm text-red-600 font-medium">Listening to you...</span>
            <AudioLines className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
        );
      case 'listening':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <div className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse opacity-60" />
            </div>
            <span className="text-sm text-[#767683] font-medium">Ready — just speak</span>
            <Radio className="w-3.5 h-3.5 text-emerald-500 opacity-60" />
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-gray-300 rounded-full" />
            <span className="text-sm text-[#767683]">Microphone paused</span>
          </div>
        );
    }
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Status Bar + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getVADIndicator()}
          {getProviderBadge()}
        </div>
        <button
          onClick={toggleInputMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#767683] hover:text-[#191c1e] bg-gray-50 hover:bg-gray-100 transition-all border border-gray-200"
        >
          {useTextInput ? <Mic className="w-3 h-3" /> : <Type className="w-3 h-3" />}
          {useTextInput ? 'Voice' : 'Type'}
        </button>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <WifiOff className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">{connectionError}</span>
        </div>
      )}

      {/* VAD Visualization (for voice mode) */}
      {!useTextInput && sttProvider === 'assemblyai' && connectionState === 'connected' && (
        <div className={`flex items-center justify-center py-4 rounded-xl border transition-all duration-500 ${vadState === 'speaking'
          ? 'bg-red-50/50 border-red-200 shadow-sm shadow-red-100'
          : 'bg-[#f7f9fb] border-gray-100'
          }`}>
          {/* Animated mic icon */}
          <div className={`flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500 ${vadState === 'speaking'
            ? 'bg-red-100 ring-4 ring-red-200/50 scale-110'
            : 'bg-[#eef2ff] ring-2 ring-[#e0e0ff]/50'
            }`}>
            {vadState === 'speaking' ? (
              <Mic className="w-6 h-6 text-red-600 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6 text-[#000666] opacity-60" />
            )}
          </div>
        </div>
      )}

      {/* Web Speech fallback — manual start/stop buttons */}
      {!useTextInput && sttProvider === 'webspeech' && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#767683]">
            Browser speech recognition active — speak into your microphone.
          </span>
        </div>
      )}

      {/* Text Input Fallback */}
      {useTextInput && (
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder="Type your answer here..."
          className="input-field min-h-[120px] resize-y"
          rows={4}
        />
      )}

      {/* Transcript Preview (for voice mode) */}
      {!useTextInput && transcript && (
        <div className="p-4 rounded-xl bg-[#f7f9fb] border border-gray-100">
          <p className="text-xs text-[#767683] mb-1 uppercase tracking-wider">Transcript</p>
          <p className="text-sm text-[#454652] leading-relaxed">{transcript}</p>
        </div>
      )}
    </div>
  );
});

VoiceRecorder.displayName = 'VoiceRecorder';

export default VoiceRecorder;
