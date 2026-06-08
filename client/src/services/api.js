import axios from 'axios';
import { API_URL } from '../utils/constants';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 (expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on auth pages
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/signup')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===== Auth API =====
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// ===== Interview API =====
export const interviewAPI = {
  // Start a new interview (multipart form data for file uploads)
  start: (formData) => 
    api.post('/interviews/start', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min timeout for AI processing
    }),
  
  // Get all interviews for current user
  getAll: () => api.get('/interviews'),
  
  // Get single interview by ID
  getById: (id) => api.get(`/interviews/${id}`),
  
  // Submit an answer and get the next dynamically-generated question
  submitAnswer: (id, answerData) => 
    api.put(`/interviews/${id}/answer`, answerData, {
      timeout: 60000, // 60s timeout — AI generates next question after saving answer
    }),
  
  // Complete interview and trigger evaluation
  complete: (id, data) => 
    api.post(`/interviews/${id}/complete`, data, {
      timeout: 120000, // 2 min timeout for AI evaluation
    }),
};

// ===== Report API =====
export const reportAPI = {
  // Get report by interview ID
  getByInterviewId: (interviewId) => 
    api.get(`/reports/${interviewId}`),
};

// ===== AssemblyAI API =====
export const assemblyaiAPI = {
  // Get a temporary streaming token for browser-based real-time STT
  getToken: () => api.get('/assemblyai/token'),
};

// ===== Chat API =====
export const chatAPI = {
  // Reindex user's interview data in the vector store
  reindex: () => api.post('/chat/reindex'),

  // Get chat history for a session
  getHistory: (sessionId) => api.get(`/chat/history/${sessionId}`),
};

export default api;
