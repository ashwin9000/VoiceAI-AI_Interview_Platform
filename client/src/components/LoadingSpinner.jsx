import { Loader2 } from 'lucide-react';

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
  xl: 'w-16 h-16',
};

const LoadingSpinner = ({ size = 'md', text = '', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className={`${sizes[size]} text-[#4e45d5] animate-spin`} />
      {text && (
        <p className="text-sm text-[#767683] animate-pulse">{text}</p>
      )}
    </div>
  );
};

// Skeleton loading variant for content placeholders
export const SkeletonCard = ({ className = '' }) => (
  <div className={`card p-6 space-y-4 ${className}`}>
    <div className="skeleton h-4 w-3/4 rounded" />
    <div className="skeleton h-3 w-full rounded" />
    <div className="skeleton h-3 w-5/6 rounded" />
    <div className="skeleton h-10 w-1/3 rounded-xl mt-4" />
  </div>
);

export const SkeletonLine = ({ width = 'w-full', height = 'h-4' }) => (
  <div className={`skeleton ${width} ${height} rounded`} />
);

export default LoadingSpinner;
