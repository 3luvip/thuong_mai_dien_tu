// ═══════════════════════════════════════════════════════════════════════════════
// src/context/toast.tsx
// Global Toast System — dùng ở mọi nơi trong app
//
// CÁCH DÙNG:
//   import { useToast } from "../../context/toast";
//   const toast = useToast();
//   toast.success("Mua hàng thành công!");
//   toast.error("Sai mật khẩu!");
//   toast.info("Đang xử lý...");
//   toast.warning("Phiên đăng nhập sắp hết hạn.");
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import {
  IoCheckmarkCircle,
  IoCloseCircle,
  IoInformationCircle,
  IoWarning,
  IoClose,
} from "react-icons/io5";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id:       string;
  type:     ToastType;
  title:    string;
  message?: string;
  duration: number;          // ms, 0 = persistent
}

interface ToastContextValue {
  success: (title: string, message?: string, duration?: number) => void;
  error:   (title: string, message?: string, duration?: number) => void;
  info:    (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toast: Toast = { id, type, title, message, duration };

      setToasts((prev) => {
        // Max 5 toasts hiện cùng lúc — xóa cái cũ nhất nếu vượt
        const next = prev.length >= 5 ? prev.slice(1) : prev;
        return [...next, toast];
      });

      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const api: ToastContextValue = {
    success: (t, m, d) => push("success", t, m, d),
    error:   (t, m, d) => push("error",   t, m, d ?? 5000),
    info:    (t, m, d) => push("info",    t, m, d),
    warning: (t, m, d) => push("warning", t, m, d ?? 5000),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts:    Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{TOAST_CSS}</style>
      <div className="toast-container" role="region" aria-label="Thông báo">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  );
}

// ─── Toast Item ───────────────────────────────────────────────────────────────
const ICONS: Record<ToastType, React.ReactElement> = {
  success: <IoCheckmarkCircle />,
  error:   <IoCloseCircle />,
  info:    <IoInformationCircle />,
  warning: <IoWarning />,
};

const COLORS: Record<ToastType, { border: string; icon: string; progress: string; bg: string }> = {
  success: { border: "#22c55e", icon: "#4ade80", progress: "#22c55e", bg: "rgba(34,197,94,0.08)"  },
  error:   { border: "#ef4444", icon: "#f87171", progress: "#ef4444", bg: "rgba(239,68,68,0.08)"  },
  info:    { border: "#6366f1", icon: "#818cf8", progress: "#6366f1", bg: "rgba(99,102,241,0.08)" },
  warning: { border: "#f59e0b", icon: "#fbbf24", progress: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
};

const LABELS: Record<ToastType, string> = {
  success: "Thành công",
  error:   "Lỗi",
  info:    "Thông tin",
  warning: "Cảnh báo",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast:     Toast;
  onDismiss: (id: string) => void;
}) {
  const c = COLORS[toast.type];

  return (
    <div
      className="toast-item"
      role="alert"
      style={{
        borderLeft: `3px solid ${c.border}`,
        background: `linear-gradient(135deg, #0f172a 0%, ${c.bg} 100%)`,
        // progress bar duration via CSS var
        ["--progress-color" as string]: c.progress,
        ["--toast-duration" as string]: toast.duration > 0 ? `${toast.duration}ms` : "none",
      }}
    >
      {/* Icon */}
      <span className="toast-icon" style={{ color: c.icon }}>
        {ICONS[toast.type]}
      </span>

      {/* Body */}
      <div className="toast-body">
        <p className="toast-label" style={{ color: c.icon }}>
          {LABELS[toast.type]}
        </p>
        <p className="toast-title">{toast.title}</p>
        {toast.message && (
          <p className="toast-message">{toast.message}</p>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        className="toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Đóng thông báo"
      >
        <IoClose />
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="toast-progress" />
      )}
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const TOAST_CSS = `
  .toast-container {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    max-width: 380px;
    width: calc(100vw - 40px);
  }

  .toast-item {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px 18px;
    border-radius: 12px;
    border: 1px solid rgba(148,163,184,0.12);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
    pointer-events: all;
    overflow: hidden;
    animation: toast-in 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(100%) scale(0.9); }
    to   { opacity: 1; transform: translateX(0)   scale(1);   }
  }

  .toast-icon {
    font-size: 22px;
    flex-shrink: 0;
    margin-top: 1px;
    line-height: 1;
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin: 0 0 2px;
  }

  .toast-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    margin: 0;
    line-height: 1.4;
  }

  .toast-message {
    font-size: 12px;
    color: #94a3b8;
    margin: 3px 0 0;
    line-height: 1.45;
  }

  .toast-close {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: #475569;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    line-height: 1;
    transition: color 0.15s ease;
    margin-top: 1px;
  }

  .toast-close:hover { color: #94a3b8; }

  /* Progress bar — shrinks from 100% to 0 over duration */
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    width: 100%;
    background: var(--progress-color);
    border-radius: 0 0 12px 12px;
    transform-origin: left;
    animation: toast-progress var(--toast-duration) linear forwards;
    opacity: 0.6;
  }

  @keyframes toast-progress {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }

  @media (max-width: 480px) {
    .toast-container {
      top: auto;
      bottom: 20px;
      right: 12px;
      left: 12px;
      width: auto;
      max-width: none;
    }
  }
`;