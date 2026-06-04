const AudioWaveform = ({ isActive = false, barCount = 5, className = '' }) => {
  return (
    <div className={`flex items-center justify-center gap-1 h-10 ${className}`}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            animationDelay: `${i * 0.1}s`,
            animationPlayState: isActive ? 'running' : 'paused',
            height: isActive ? undefined : '8px',
            opacity: isActive ? 1 : 0.3,
            transition: 'opacity 0.3s ease',
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveform;
