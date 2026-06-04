import { useEffect, useState } from 'react';

const ScoreCircle = ({ score = 0, size = 120, strokeWidth = 8, label = '', delay = 0 }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedScore / 100) * circumference;

  // Determine color based on score
  const getColor = (s) => {
    if (s >= 80) return { stroke: '#059669', text: 'text-emerald-700', glow: 'rgba(5, 150, 105, 0.2)' };
    if (s >= 60) return { stroke: '#ca8a04', text: 'text-yellow-700', glow: 'rgba(202, 138, 4, 0.2)' };
    if (s >= 40) return { stroke: '#ea580c', text: 'text-orange-700', glow: 'rgba(234, 88, 12, 0.2)' };
    return { stroke: '#dc2626', text: 'text-red-700', glow: 'rgba(220, 38, 38, 0.2)' };
  };

  const color = getColor(score);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Animate the score counting up
      let current = 0;
      const increment = score / 60; // ~60 frames
      const interval = setInterval(() => {
        current += increment;
        if (current >= score) {
          setAnimatedScore(score);
          clearInterval(interval);
        } else {
          setAnimatedScore(Math.round(current));
        }
      }, 16);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timer);
  }, [score, delay]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Animated progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="score-circle"
            style={{
              filter: `drop-shadow(0 0 6px ${color.glow})`,
            }}
          />
        </svg>
        {/* Score text in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-display ${color.text}`}>
            {animatedScore}
          </span>
          <span className="text-[10px] text-[#767683] uppercase tracking-wider">
            / 100
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-[#767683] font-medium text-center">{label}</span>
      )}
    </div>
  );
};

export default ScoreCircle;
