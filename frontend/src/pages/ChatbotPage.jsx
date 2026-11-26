import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Sliders,
  Loader2,
  AlertCircle,
  User,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { sendChatMessage } from '../services/api.js';

const STARTER_PROMPTS = [
  'Explain Retrieval-Augmented Generation (RAG) in simple terms.',
  'Summarize Python list comprehensions with 3 beginner examples.',
  'How does LLM temperature affect chatbot responses?',
  'Give me a 5-point revision checklist for Prompt Engineering.',
];

export default function ChatbotPage({ healthStatus }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I am your CampusX AI Tutor. Ask me to explain programming concepts, summarize study notes, or help you prepare for Prompt Engineering exams.',
      meta: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const geminiConfigured = healthStatus?.integrations?.gemini_configured;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const getTempLabel = (temp) => {
    if (temp <= 0.3) return 'Focused & Deterministic';
    if (temp <= 0.7) return 'Balanced Study Mode';
    return 'Creative & Exploratory';
  };

  const handleSend = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      meta: null,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await sendChatMessage({
        messages: apiMessages,
        temperature,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          meta: `Model: ${data.model} • Temperature: ${data.temperature}`,
        },
      ]);
    } catch (err) {
      setError(err.message || 'Failed to get a response from the AI Chatbot.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Conversation cleared. What topic would you like to study next?',
        meta: null,
      },
    ]);
    setError('');
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Gemini Student Chatbot
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Conversational AI study tutor powered by Google Gemini with adjustable temperature
            control (0.1 to 1.0).
          </p>
        </div>

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear Conversation</span>
        </button>
      </div>

      {/* Missing Gemini Key Banner */}
      {healthStatus && !geminiConfigured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <KeyRound className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="font-bold">Google Gemini API Key Configuration Required</div>
            <p className="mt-0.5 opacity-90">
              <code>GEMINI_API_KEY</code> is not set in <code>backend/.env</code>. Add your key on
              the backend and restart FastAPI to generate real AI responses. CampusX never fakes AI
              replies.
            </p>
          </div>
        </div>
      )}

      {/* Temperature Slider Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Temperature: {temperature.toFixed(1)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {getTempLabel(temperature)} — sent directly to Gemini API
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:w-72">
          <span className="text-xs font-semibold text-slate-400">0.1</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            aria-label="Model temperature"
            className="flex-1 accent-indigo-600"
          />
          <span className="text-xs font-semibold text-slate-400">1.0</span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-navy-900 shadow-sm flex flex-col h-[520px]">
        {/* Starter Prompts */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSend(prompt)}
              disabled={loading}
              className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-600 dark:hover:text-indigo-400 whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div className={`max-w-[82%] space-y-1 ${isUser ? 'items-end text-right' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-left ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.meta && (
                    <div className="text-[11px] text-slate-400 px-1">{msg.meta}</div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-100 dark:bg-navy-800 px-4 py-3 text-sm text-slate-500 dark:text-slate-300 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span>Generating response (temp {temperature.toFixed(1)})...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs sm:text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a programming, study, or Prompt Engineering question..."
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-navy-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
