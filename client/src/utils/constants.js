// Role categories for the dashboard
export const ROLES = [
  {
    id: 'frontend-developer',
    name: 'Frontend Developer',
    description: 'Build beautiful, responsive user interfaces with modern frameworks.',
    icon: 'Monitor',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'backend-developer',
    name: 'Backend Developer',
    description: 'Design robust server-side architectures and APIs.',
    icon: 'Server',
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'fullstack-developer',
    name: 'Full Stack Developer',
    description: 'Master both frontend and backend development.',
    icon: 'Layers',
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'react-developer',
    name: 'React Developer',
    description: 'Specialize in React ecosystem and component architecture.',
    icon: 'Atom',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'nodejs-developer',
    name: 'Node.js Developer',
    description: 'Build scalable server-side applications with Node.js.',
    icon: 'Hexagon',
    color: 'from-green-600 to-lime-500',
  },
  {
    id: 'java-developer',
    name: 'Java Developer',
    description: 'Enterprise-grade application development with Java.',
    icon: 'Coffee',
    color: 'from-orange-500 to-red-500',
  },
  {
    id: 'python-developer',
    name: 'Python Developer',
    description: 'Versatile development with Python for web, data, and automation.',
    icon: 'Terminal',
    color: 'from-yellow-500 to-blue-500',
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Transform raw data into actionable business insights.',
    icon: 'BarChart3',
    color: 'from-teal-500 to-cyan-500',
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    description: 'Apply statistical models and ML to solve complex problems.',
    icon: 'BrainCircuit',
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 'ml-engineer',
    name: 'Machine Learning Engineer',
    description: 'Design and deploy production-ready ML systems.',
    icon: 'Cpu',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'devops-engineer',
    name: 'DevOps Engineer',
    description: 'Automate infrastructure and streamline CI/CD pipelines.',
    icon: 'GitBranch',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Broad software engineering covering systems, design, and coding.',
    icon: 'Code2',
    color: 'from-indigo-500 to-blue-500',
  },
];

// Language categories for the dashboard
export const LANGUAGES = [
  { id: 'java', name: 'Java', icon: 'Coffee', color: 'from-orange-500 to-red-500' },
  { id: 'python', name: 'Python', icon: 'Terminal', color: 'from-yellow-500 to-blue-500' },
  { id: 'javascript', name: 'JavaScript', icon: 'FileCode', color: 'from-yellow-400 to-amber-500' },
  { id: 'typescript', name: 'TypeScript', icon: 'FileType', color: 'from-blue-500 to-indigo-500' },
  { id: 'cpp', name: 'C++', icon: 'Braces', color: 'from-blue-600 to-purple-600' },
  { id: 'c', name: 'C', icon: 'Hash', color: 'from-gray-500 to-blue-600' },
  { id: 'go', name: 'Go', icon: 'Workflow', color: 'from-cyan-500 to-teal-500' },
];

// Grade mapping based on score
export const getGrade = (score) => {
  if (score >= 95) return { grade: 'A+', color: 'text-emerald-400' };
  if (score >= 90) return { grade: 'A', color: 'text-emerald-400' };
  if (score >= 85) return { grade: 'B+', color: 'text-green-400' };
  if (score >= 80) return { grade: 'B', color: 'text-green-400' };
  if (score >= 75) return { grade: 'C+', color: 'text-yellow-400' };
  if (score >= 70) return { grade: 'C', color: 'text-yellow-400' };
  if (score >= 60) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
};

// Score color based on value
export const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

// Score bar gradient based on value
export const getScoreGradient = (score) => {
  if (score >= 80) return 'from-emerald-500 to-green-400';
  if (score >= 60) return 'from-yellow-500 to-amber-400';
  if (score >= 40) return 'from-orange-500 to-amber-400';
  return 'from-red-500 to-rose-400';
};

// API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
