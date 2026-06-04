import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, Type } from 'lucide-react';

const VoiceRecorder = ({ onTranscript, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [useTextInput, setUseTextInput] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  // Check if Web Speech API is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setUseTextInput(true);
    }
  }, []);

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      const combined = (finalTranscript + interimTranscript).trim();
      setTranscript(combined);
      onTranscript?.(combined);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setIsSupported(false);
        setUseTextInput(true);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    return recognition;
  }, [onTranscript]);

  // Start recording
  const startRecording = useCallback(() => {
    if (disabled || useTextInput) return;
    
    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setTranscript('');
  }, [disabled, useTextInput, initRecognition]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Spacebar hold-to-record
  useEffect(() => {
    if (useTextInput || disabled) return;

    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat && !isRecording && 
          document.activeElement?.tagName !== 'INPUT' && 
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        startRecording();
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && isRecording) {
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
  }, [isRecording, startRecording, stopRecording, useTextInput, disabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Handle text input change
  const handleTextChange = (e) => {
    setTranscript(e.target.value);
    onTranscript?.(e.target.value);
  };

  // Toggle between voice and text input
  const toggleInputMode = () => {
    if (isRecording) stopRecording();
    setUseTextInput(!useTextInput);
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full recording-pulse" />
              <span className="text-sm text-red-600 font-medium">Recording...</span>
            </div>
          )}
          {!isRecording && !useTextInput && (
            <span className="text-xs text-[#767683]">
              Hold <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[#000666] font-mono text-[10px] border border-gray-200">SPACE</kbd> to record
            </span>
          )}
        </div>
        <button
          onClick={toggleInputMode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#767683] hover:text-[#191c1e] bg-gray-50 hover:bg-gray-100 transition-all border border-gray-200"
        >
          {useTextInput ? <Mic className="w-3 h-3" /> : <Type className="w-3 h-3" />}
          {useTextInput ? 'Voice' : 'Type'}
        </button>
      </div>

      {/* Voice Controls */}
      {!useTextInput && (
        <div className="flex items-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 ${
              isRecording
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-[#eef2ff] text-[#000666] border border-[#e0e0ff] hover:bg-[#e0e0ff]'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          
          {!isSupported && (
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
};

export default VoiceRecorder;
