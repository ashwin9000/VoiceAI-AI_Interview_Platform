import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../utils/constants';
import Sidebar from '../components/Sidebar';
import {
  Sparkles, Send, Bot, User, ChevronDown, RefreshCw,
  MessageSquare, TrendingUp, Target, BookOpen, Loader2, AlertCircle,
} from 'lucide-react';

// ── Suggested Questions ───────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  {
    icon: TrendingUp,
    label: 'Performance',
    question: 'How did I perform in my last interview?',
  },
  {
    icon: Target,
    label: 'Weaknesses',
    question: 'What are my weakest topics across all interviews?',
  },
  {
    icon: MessageSquare,
    label: 'Questions',
    question: 'What questions were asked in my most recent interview?',
  },
  {
    icon: BookOpen,
    label: 'Study Plan',
    question: 'Create a study plan based on my weak areas.',
  },
];

// ── Simple Markdown Renderer ──────────────────────────────────────────────

const renderMarkdown = (text) => {
  if (!text) return '';
  // Ensure text is always a string — content can arrive as object/array from SSE
  const str = typeof text === 'string' ? text : String(text);

  // Process line by line
  const lines = str.split('\n');
  let html = '';
  let inCodeBlock = false;
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += '</code></pre>';
        inCodeBlock = false;
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<pre class="chat-code-block"><code>';
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      html += escapeHtml(line) + '\n';
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h4 class="chat-h4">${processInline(line.slice(4))}</h4>`;
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 class="chat-h3">${processInline(line.slice(3))}</h3>`;
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 class="chat-h2">${processInline(line.slice(2))}</h2>`;
      continue;
    }

    // Unordered list items
    if (/^[\s]*[-*•]\s/.test(line)) {
      if (!inList) { html += '<ul class="chat-list">'; inList = true; }
      const content = line.replace(/^[\s]*[-*•]\s/, '');
      html += `<li>${processInline(content)}</li>`;
      continue;
    }

    // Numbered list items
    if (/^\s*\d+\.\s/.test(line)) {
      if (!inList) { html += '<ol class="chat-list chat-list-ordered">'; inList = true; }
      const content = line.replace(/^\s*\d+\.\s/, '');
      html += `<li>${processInline(content)}</li>`;
      continue;
    }

    // Close list if line is not a list item
    if (inList && line.trim() === '') {
      html += '</ul>';
      inList = false;
    }

    // Empty lines
    if (line.trim() === '') {
      html += '<br/>';
      continue;
    }

    // Regular paragraph
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p class="chat-p">${processInline(line)}</p>`;
  }

  if (inList) html += '</ul>';
  if (inCodeBlock) html += '</code></pre>';

  return html;
};

const escapeHtml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const processInline = (text) => {
  let result = escapeHtml(text);
  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  result = result.replace(/`(.+?)`/g, '<code class="chat-inline-code">$1</code>');
  return result;
};

// ── Chat Page Component ───────────────────────────────────────────────────

const ChatPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem('chat_session_id');
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('chat_session_id', id);
    return id;
  });
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  // Send message via SSE
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming) return;

    const userMessage = { role: 'user', content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setError(null);

    // Add placeholder for assistant message
    const assistantId = Date.now();
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', sources: [], timestamp: new Date(), id: assistantId },
    ]);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ message: text.trim(), session_id: sessionId }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let sources = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === 'token') {
                const tokenText = typeof parsed.text === 'string' ? parsed.text : String(parsed.text || '');
                fullText += tokenText;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, content: fullText } : msg
                  )
                );
              } else if (eventType === 'sources') {
                sources = Array.isArray(parsed) ? parsed : [];
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId ? { ...msg, sources } : msg
                  )
                );
              } else if (eventType === 'done') {
                const doneText = typeof parsed.text === 'string' ? parsed.text : String(parsed.text || '');
                fullText = doneText || fullText;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantId
                      ? { ...msg, content: fullText, sources }
                      : msg
                  )
                );
              } else if (eventType === 'error') {
                setError(parsed.error || 'An error occurred');
              }
            } catch {
              // Skip unparseable data
            }
            eventType = '';
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to connect to the assistant. Please check that the RAG service is running.');
      // Remove the empty assistant message
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId]);

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Handle keyboard
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Handle suggested question click
  const handleSuggestion = (question) => {
    sendMessage(question);
  };

  // New session
  const handleNewSession = () => {
    const id = crypto.randomUUID();
    sessionStorage.setItem('chat_session_id', id);
    setMessages([]);
    setError(null);
    window.location.reload();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="page-enter min-h-screen bg-[#f7f9fb]">
      <Sidebar activePath="/chat" />

      <main className="md:ml-[220px] min-h-screen flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-gray-100">
          <div className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a1a5e] to-[#4e45d5] flex items-center justify-center shadow-lg shadow-indigo-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#191c1e]">Interview Assistant</h1>
                <p className="text-[11px] text-[#767683] font-medium">Powered by your interview history</p>
              </div>
            </div>
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#454652] hover:text-[#1a1a5e] hover:bg-[#eef2ff] rounded-lg transition-colors"
              title="Start new conversation"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pt-6 pb-36">
          <div className="max-w-3xl mx-auto w-full">
            {/* Empty State */}
            {!hasMessages && (
              <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a1a5e] to-[#6860ef] flex items-center justify-center mb-6 shadow-xl shadow-indigo-200">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-[#191c1e] mb-2 font-display">
                  Interview Assistant
                </h2>
                <p className="text-sm text-[#767683] mb-8 text-center max-w-md">
                  Ask me anything about your past interviews — performance analysis,
                  question review, progress tracking, or study recommendations.
                </p>

                {/* Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTED_QUESTIONS.map((sq) => {
                    const Icon = sq.icon;
                    return (
                      <button
                        key={sq.label}
                        onClick={() => handleSuggestion(sq.question)}
                        className="card p-4 text-left group hover:border-[#bdc2ff] hover:shadow-lg hover:shadow-indigo-100 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-[#eef2ff] flex items-center justify-center group-hover:bg-[#1a1a5e] transition-colors">
                            <Icon className="w-4 h-4 text-[#1a1a5e] group-hover:text-white transition-colors" />
                          </div>
                          <span className="text-xs font-semibold text-[#767683] uppercase tracking-wider">
                            {sq.label}
                          </span>
                        </div>
                        <p className="text-sm text-[#454652] leading-relaxed">
                          {sq.question}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message List */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-message-enter flex gap-3 mb-6 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Assistant avatar */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a1a5e] to-[#4e45d5] flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-[#1a1a5e] text-white rounded-2xl rounded-br-md px-5 py-3'
                      : 'bg-white border border-gray-100 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      {/* Streaming indicator when content is empty */}
                      {msg.content === '' && isStreaming && idx === messages.length - 1 ? (
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex gap-1.5">
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                            <div className="typing-dot"></div>
                          </div>
                          <span className="text-xs text-[#767683]">Thinking...</span>
                        </div>
                      ) : (
                        <div
                          className="chat-content text-sm text-[#191c1e] leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      )}

                      {/* Source Citations */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-[#767683] uppercase tracking-wider mb-2">
                            Sources referenced
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {msg.sources.map((src, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eef2ff] text-[#1a1a5e] text-[11px] font-medium rounded-md"
                              >
                                <MessageSquare className="w-3 h-3" />
                                {src.role} • {src.date} • {src.score}/100
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* User avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-[#eef2ff] flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4 text-[#1a1a5e]" />
                  </div>
                )}
              </div>
            ))}

            {/* Error Message */}
            {error && (
              <div className="chat-message-enter flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl mb-4 max-w-2xl mx-auto">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="fixed bottom-0 right-0 left-0 md:left-[220px] bg-gradient-to-t from-[#f7f9fb] via-[#f7f9fb] to-transparent pt-6 pb-6 px-4 md:px-6">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto w-full"
          >
            <div className="relative bg-white border border-gray-200 rounded-2xl shadow-lg shadow-gray-100/50 focus-within:border-[#1a1a5e] focus-within:shadow-xl focus-within:shadow-indigo-100/30 transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your interviews..."
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none bg-transparent px-5 py-4 pr-14 text-sm text-[#191c1e] placeholder:text-[#9ca3af] focus:outline-none disabled:opacity-50 max-h-40"
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className={`absolute right-3 bottom-3 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  input.trim() && !isStreaming
                    ? 'bg-[#1a1a5e] text-white hover:bg-[#2d2d7a] shadow-md'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] text-[#9ca3af] mt-2">
              Responses are grounded in your interview data. Press Enter to send, Shift+Enter for new line.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
