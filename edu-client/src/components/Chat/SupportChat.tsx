import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import "../../style/components/_support_chat.scss";

type Suggestion = {
  title: string;
  category: string;
  url: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  suggestions?: Suggestion[];
};

const quickPrompts = [
  "Web dev for beginners",
  "Intro to AI & ML",
  "Online marketing",
  "UI/UX Design",
];

const greetings = ["hello", "hi", "hey", "greetings", "howdy", "sup", "good morning", "good evening"];

function SupportChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Hi there! 👋 I can recommend courses based on your interests. What topic are you looking to learn?",
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

  // Focus input when chat opens
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  async function sendMessage(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: clean,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const normalized = clean.toLowerCase();
    if (greetings.some((g) => normalized.includes(g))) {
      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: "Hello! 😊 What topic are you interested in learning? For example: JavaScript, Data Science, Design, Marketing...",
      };
      setMessages((prev) => [...prev, botMsg]);
      if (!open) setUnreadCount((c) => c + 1);
      setLoading(false);
      return;
    }

    try {
      const res = await axiosInstance.post<{ answer?: string; suggestions?: Suggestion[] }>(
        "/ai/suggest",
        { query: clean, limit: 5 }
      );

      const suggestions = res.data?.suggestions ?? [];
      const answer = res.data?.answer?.trim();
      const botText =
        answer && answer.length > 0
          ? answer
          : suggestions.length
          ? "Here are some courses that match your interests:"
          : "I couldn't find a perfect match. Could you describe what you're looking for in more detail?";

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: botText,
        suggestions: suggestions.length ? suggestions : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
      if (!open) setUnreadCount((c) => c + 1);
    } catch {
      const errMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: "Oops! I'm having trouble connecting right now. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="sc-wrapper">
      {/* ── Floating toggle button ── */}
      <button
        type="button"
        className={`sc-toggle ${open ? "sc-toggle--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close course advisor" : "Open course advisor"}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && unreadCount > 0 && (
          <span className="sc-toggle__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {/* ── Chat panel ── */}
      <aside className={`sc-panel ${open ? "sc-panel--open" : ""}`} aria-label="AI course advisor">
        <div className="sc-panel__header">
          <div className="sc-panel__header-left">
            <div className="sc-panel__avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
              </svg>
            </div>
            <div>
              <div className="sc-panel__title">Course Advisor</div>
              <div className="sc-panel__status">
                <span className="sc-panel__dot" />
                AI-powered · Always on
              </div>
            </div>
          </div>
          <button
            type="button"
            className="sc-panel__close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="sc-panel__messages" ref={listRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`sc-msg sc-msg--${msg.role}`}>
              {msg.role === "bot" && (
                <div className="sc-msg__avatar">AI</div>
              )}
              <div className="sc-msg__bubble">
                <p className="sc-msg__text">{msg.text}</p>
                {msg.suggestions && (
                  <div className="sc-suggestions">
                    {msg.suggestions.map((sug) => (
                      <Link
                        key={sug.url}
                        to={sug.url}
                        className="sc-suggestion"
                        onClick={() => setOpen(false)}
                      >
                        <span className="sc-suggestion__title">{sug.title}</span>
                        <span className="sc-suggestion__category">{sug.category}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="sc-msg sc-msg--bot">
              <div className="sc-msg__avatar">AI</div>
              <div className="sc-msg__bubble">
                <div className="sc-typing">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sc-panel__quick">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="sc-chip"
              onClick={() => void sendMessage(prompt)}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>

        <form className="sc-panel__form" onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className="sc-panel__input"
            type="text"
            placeholder="Ask about a course topic..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="sc-panel__send" type="submit" disabled={!canSend}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </aside>
    </div>
  );
}

export default SupportChat;