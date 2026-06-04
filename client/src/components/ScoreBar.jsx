import { useEffect, useState } from 'react';
import { getScoreGradient } from '../utils/constants';

const ScoreBar = ({ label, score = 0, delay = 0, icon: Icon }) => {
  const [animatedWidth, setAnimatedWidth] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedWidth(score);
      // Animate the number
      let current = 0;
      const increment = score / 40;
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

  const gradient = getScoreGradient(score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[#767683]" />}
          <span className="text-sm font-medium text-[#454652]">{label}</span>
        </div>
        <span className="text-sm font-bold text-[#191c1e]">{animatedScore}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradient} score-bar-fill`}
          style={{ width: `${animatedWidth}%` }}
        />
      </div>
    </div>
  );
};

export default ScoreBar;
