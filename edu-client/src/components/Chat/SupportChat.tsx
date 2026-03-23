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
  "Lập trình web cho người mới",
  "Khóa học AI cơ bản",
  "Marketing online",
  "Thiết kế UI/UX",
];

const greetings = ["xin chao", "chao", "hello", "hi", "hey", "chào", "xin chào"];
const faqRules: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["dang ky", "dang ki", "dang ky khoa hoc", "dang ki khoa hoc", "register"],
    answer:
      "Cach dang ky khoa hoc (chi tiet):\n1) Tao tai khoan o /signup hoac dang nhap o /login.\n2) Vao danh sach khoa hoc o /courses, chon khoa hoc muon hoc.\n3) Bam Them vao gio hoac Mua ngay tren trang chi tiet khoa hoc.\n4) Vao gio hang /cart de kiem tra va tien hanh thanh toan.\n5) Sau khi mua thanh cong, vao /my-courses de bat dau hoc.",
  },
  {
    keywords: ["thanh toan", "payment", "mua khoa hoc", "mua"],
    answer:
      "Thanh toan (chi tiet):\n1) Mo trang khoa hoc can mua.\n2) Bam Mua ngay hoac Them vao gio.\n3) Vao /cart, kiem tra thong tin khoa hoc va gia.\n4) Tien hanh thanh toan theo huong dan hien tren man hinh.\n5) Hoan tat xong, khoa hoc se xuat hien trong /my-courses.",
  },
  {
    keywords: ["thong tin", "gioi thieu", "ve chung toi", "about", "lien he", "ho tro", "support"],
    answer:
      "Thong tin co ban: day la nen tang hoc tap truc tuyen. Ban co the:\n- Tao tai khoan o /signup va dang nhap o /login.\n- Tim khoa hoc tai /courses.\n- Mua khoa hoc va quan ly trong /cart va /my-courses.\nNeu can ho tro chi tiet, hay mo ta van de (loi dang nhap, thanh toan, khoa hoc...).",
  },
  {
    keywords: ["dang nhap", "login", "quen mat khau", "mat khau"],
    answer:
      "Dang nhap: vao /login, nhap email va mat khau. Neu quen mat khau, hay lien he quan tri vien hoac nhan ho tro qua kenh lien he cua web.",
  },
  {
    keywords: ["giang vien", "instructor", "tao khoa hoc"],
    answer:
      "Neu ban la giang vien: sau khi dang nhap voi role giang vien, vao /instructor-dashboard de quan ly, va /create-course de tao khoa hoc moi.",
  },
];

function SupportChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      text: "Chào bạn! Mình có thể gợi ý khóa học phù hợp. Bạn đang quan tâm chủ đề nào?",
    },
  ]);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading]);

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
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: "Chào bạn! Bạn đang muốn học chủ đề nào? Ví dụ: JavaScript, UI/UX, Data, Marketing...",
        },
      ]);
      setLoading(false);
      return;
    }

    const faq = faqRules.find((r) => r.keywords.some((k) => normalized.includes(k)));
    if (faq) {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: faq.answer,
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const role = localStorage.getItem("role");
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));

      const res = await axiosInstance.post<{ answer?: string; suggestions?: Suggestion[] }>(
        "/ai/suggest",
        {
          query: clean,
          limit: 5,
          style: "brief",
          history,
          user: {
            is_authenticated: !!token,
            role: role || "guest",
          },
        }
      );

      const suggestions = res.data?.suggestions ?? [];
      const answer = res.data?.answer?.trim();
      const botText =
        answer && answer.length > 0
          ? answer
          : suggestions.length
          ? "Day la mot vai khoa hoc phu hop voi ban:"
          : "Minh chua tim thay khoa hoc phu hop. Ban co the mo ta cu the hon khong?";

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "bot",
        text: botText,
        suggestions: suggestions.length ? suggestions : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: "bot",
          text: "Hiện tại mình chưa kết nối được dịch vụ tư vấn. Bạn thử lại sau nhé.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <aside className="support-chat" aria-label="AI course advisor">
      <div className="support-chat__header">
        <div className="support-chat__title">Tư vấn khóa học</div>
        <div className="support-chat__subtitle">AI gợi ý nhanh theo nhu cầu</div>
      </div>

      <div className="support-chat__messages" ref={listRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`support-chat__msg support-chat__msg--${msg.role}`}>
            <p className="support-chat__text">{msg.text}</p>
            {msg.suggestions && (
              <div className="support-chat__suggestions">
                {msg.suggestions.map((sug) => (
                  <Link key={sug.url} to={sug.url} className="support-chat__suggestion">
                    <span className="support-chat__suggestion-title">{sug.title}</span>
                    <span className="support-chat__suggestion-meta">{sug.category}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="support-chat__msg support-chat__msg--bot">
            <p className="support-chat__text">Đang tìm khóa học phù hợp...</p>
          </div>
        )}
      </div>

      <div className="support-chat__quick">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="support-chat__chip"
            onClick={() => void sendMessage(prompt)}
            disabled={loading}
          >
            {prompt}
          </button>
        ))}
      </div>

      <form className="support-chat__form" onSubmit={onSubmit}>
        <input
          className="support-chat__input"
          type="text"
          placeholder="Bạn cần tư vấn khóa học gì?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="support-chat__send" type="submit" disabled={!canSend}>
          Gửi
        </button>
      </form>
    </aside>
  );
}

export default SupportChat;
