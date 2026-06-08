import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Mic, MicOff, Square, Type, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { AssemblyAISTT } from '../services/assemblyaiSTT';
import ttsService from '../services/ttsService';

/**
 * VoiceRecorder — Speech-to-Text input component.
 *
 * Uses AssemblyAI Streaming v3 as the primary STT provider.
 * Falls back to browser Web Speech API if AssemblyAI is unavailable.
 * Falls back to text input if neither voice API is supported.
 *
 * Props:
 *   onTranscript(text) — called with the accumulated transcript text
 *   disabled           — disables all input
 *   onRecordingStart() — called when recording begins (for TTS barge-in)
 *   onRecordingStop()  — called when recording stops
 */
const VoiceRecorder = forwardRef(({ onTranscript, disabled = false, onRecordingStart, onRecordingStop }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [useTextInput, setUseTextInput] = useState(false);
  const [sttProvider, setSttProvider] = useState('none'); // 'assemblyai' | 'webspeech' | 'text' | 'none'
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Refs
  const assemblyaiRef = useRef(null);
  const recognitionRef = useRef(null);
  const accumulatedTextRef = useRef('');
  const textareaRef = useRef(null);
  const isRecordingRef = useRef(false); // for key event handlers

  // Keep isRecordingRef in sync
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ──────────────────────────────────────────────
  // AssemblyAI STT Management
  // ──────────────────────────────────────────────

  const initAssemblyAI = useCallback(() => {
    if (assemblyaiRef.current) return assemblyaiRef.current;

    const stt = new AssemblyAISTT();

    stt.onTranscript = (text, isFinal) => {
      const combined = text;
      setTranscript(combined);
      onTranscript?.(combined);
    };

    stt.onError = (error) => {
      console.error('[VoiceRecorder] AssemblyAI error:', error);
      setConnectionError(error.message || 'Connection error');
    };

    stt.onFallbackNeeded = () => {
      console.warn('[VoiceRecorder] Falling back to Web Speech API.');
      setSttProvider('webspeech');
      setConnectionError('AssemblyAI unavailable — using browser speech recognition');
      // Clear the error after 5s
      setTimeout(() => setConnectionError(null), 5000);
    };

    stt.onSessionStart = () => {
      setIsConnecting(false);
      setConnectionError(null);
    };

    assemblyaiRef.current = stt;
    return stt;
  }, [onTranscript]);

  // ──────────────────────────────────────────────
  // AssemblyAI Recording
  // ──────────────────────────────────────────────

  const startAssemblyAI = useCallback(async () => {
    if (disabled || useTextInput) return;

    // Stop TTS when user starts recording (barge-in)
    ttsService.stop();
    onRecordingStart?.();

    setIsConnecting(true);
    setIsRecording(true);

    const stt = initAssemblyAI();

    // Prepend any accumulated text from previous sessions
    const previousText = accumulatedTextRef.current;
    if (previousText) {
      stt.clearTranscript();
      stt._finalTranscript = previousText.trim();
    }

    const connected = await stt.connect();

    if (!connected) {
      // Fallback triggered inside connect()
      setIsRecording(false);
      setIsConnecting(false);
      return;
    }
  }, [disabled, useTextInput, initAssemblyAI, onRecordingStart]);

  const stopAssemblyAI = useCallback(async () => {
    if (assemblyaiRef.current) {
      // Save accumulated transcript before disconnecting
      const currentText = assemblyaiRef.current.getTranscript();
      if (currentText) {
        accumulatedTextRef.current = currentText.trim() + ' ';
      }
      await assemblyaiRef.current.disconnect();
    }
    setIsRecording(false);
    onRecordingStop?.();
  }, [onRecordingStop]);

  // ──────────────────────────────────────────────
  // Web Speech API Fallback
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
      setIsRecording(false);
    };

    recognition.onend = () => {
      accumulatedTextRef.current = (previousText + sessionFinalTranscript).trim() + ' ';
      setIsRecording(false);
      onRecordingStop?.();
    };

    return recognition;
  }, [onTranscript, onRecordingStop]);

  const startWebSpeech = useCallback(() => {
    if (disabled || useTextInput) return;

    // Stop TTS when user starts recording (barge-in)
    ttsService.stop();
    onRecordingStart?.();

    const recognition = initWebSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [disabled, useTextInput, initWebSpeechRecognition, onRecordingStart]);

  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ──────────────────────────────────────────────
  // Unified Start/Stop
  // ──────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (disabled || useTextInput) return;

    if (sttProvider === 'assemblyai') {
      startAssemblyAI();
    } else if (sttProvider === 'webspeech') {
      startWebSpeech();
    }
  }, [disabled, useTextInput, sttProvider, startAssemblyAI, startWebSpeech]);

  const stopRecording = useCallback(() => {
    if (sttProvider === 'assemblyai') {
      stopAssemblyAI();
    } else if (sttProvider === 'webspeech') {
      stopWebSpeech();
    }
  }, [sttProvider, stopAssemblyAI, stopWebSpeech]);

  // ──────────────────────────────────────────────
  // Initialization — Determine best STT provider
  // ──────────────────────────────────────────────

  useEffect(() => {
    // Try AssemblyAI first by checking if token endpoint is available
    const checkAssemblyAI = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/assemblyai/token', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setSttProvider('assemblyai');
          console.log('[VoiceRecorder] Using AssemblyAI STT.');
          return;
        }
      } catch (err) {
        console.warn('[VoiceRecorder] AssemblyAI token check failed:', err.message);
      }

      // Fallback: check Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSttProvider('webspeech');
        console.log('[VoiceRecorder] Using Web Speech API (fallback).');
      } else {
        setSttProvider('text');
        setUseTextInput(true);
        console.log('[VoiceRecorder] Using text input (no voice support).');
      }
    };

    checkAssemblyAI();
  }, []);

  // ──────────────────────────────────────────────
  // Spacebar hold-to-record
  // ──────────────────────────────────────────────

  useEffect(() => {
    if (useTextInput || disabled) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isRecordingRef.current &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isRecordingRef.current) {
        e.preventDefault();
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startRecording, stopRecording, useTextInput, disabled]);

  // ──────────────────────────────────────────────
  // Cleanup on unmount
  // ──────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (assemblyaiRef.current) {
        assemblyaiRef.current.destroy();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // ──────────────────────────────────────────────
  // Expose clearTranscript to parent via ref
  // ──────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    clearTranscript: () => {
      setTranscript('');
      accumulatedTextRef.current = '';
      onTranscript?.('');
      if (isRecording) stopRecording();
      if (assemblyaiRef.current) {
        assemblyaiRef.current.clearTranscript();
      }
    },
  }), [onTranscript, isRecording, stopRecording]);

  // ──────────────────────────────────────────────
  // Text input handlers
  // ──────────────────────────────────────────────

  const handleTextChange = (e) => {
    setTranscript(e.target.value);
    onTranscript?.(e.target.value);
  };

  const toggleInputMode = () => {
    if (isRecording) stopRecording();
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
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Mode Toggle + Provider Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnecting && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-[#000666] animate-spin" />
              <span className="text-sm text-[#767683] font-medium">Connecting...</span>
            </div>
          )}
          {isRecording && !isConnecting && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full recording-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording...</span>
            </div>
          )}
          {!isRecording && !isConnecting && !useTextInput && (
            <span className="text-xs text-[#767683]">
              Hold <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[#000666] font-mono text-[10px] border border-gray-200">SPACE</kbd> to record
            </span>
          )}
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

      {/* Voice Controls */}
      {!useTextInput && (
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isConnecting}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
              isRecording
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-[#eef2ff] text-[#000666] border border-[#e0e0ff] hover:bg-[#e0e0ff]'
            } ${disabled || isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Recording
              </>
            )}
          </button>

          {sttProvider === 'text' && (
            <p className="text-xs text-amber-600">
              Voice not supported in this browser. Use text input instead.
            </p>
          )}
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
