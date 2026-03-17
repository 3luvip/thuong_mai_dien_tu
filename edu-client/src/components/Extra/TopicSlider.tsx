import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../style/components/_topic_slider.scss";

interface Topic {
  label: string;
  category?: string;
}

interface TopicSliderProps {
  title?: string;
  topics?: Topic[];
  onSelect?: (category: string) => void;
}

const DEFAULT_TOPICS: Topic[] = [
  { label: "Web Development",      category: "Web Development" },
  { label: "AI / Machine Learning", category: "AI" },
  { label: "Blockchain",           category: "BlockChain" },
  { label: "App Development",      category: "App Development" },
  { label: "Data Science",         category: "AI" },
  { label: "Python",               category: "AI" },
  { label: "React",                category: "Web Development" },
  { label: "Node.js",              category: "Web Development" },
  { label: "Solidity",             category: "BlockChain" },
  { label: "Flutter",              category: "App Development" },
  { label: "Docker / K8s",         category: "Web Development" },
  { label: "Deep Learning",        category: "AI" },
];

// Số cột hiển thị cùng lúc
const COLS = 6;

function TopicSlider({
  title = "Topics recommended for you",
  topics = DEFAULT_TOPICS,
  onSelect,
}: TopicSliderProps) {
  const [selected, setSelected]   = useState<string | null>(null);
  const [page, setPage]           = useState(0);   // trang hiện tại (mỗi trang = COLS item / hàng)
  const outerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Chia thành 2 hàng, mỗi hàng có `half` item
  const half  = Math.ceil(topics.length / 2);
  const row1  = topics.slice(0, half);
  const row2  = topics.slice(half);

  // Tổng số trang
  const totalPages = Math.ceil(half / COLS);
  const canPrev    = page > 0;
  const canNext    = page < totalPages - 1;

  // Tính offset theo page: mỗi lần scroll đúng COLS cột
  // Dùng CSS variable để SCSS không cần biết số cứng
  const colWidth   = outerRef.current
    ? outerRef.current.clientWidth / COLS
    : 0;
  const offset     = page * COLS * colWidth;

  const handleSelect = (topic: Topic) => {
    const cat = topic.category ?? topic.label;
    setSelected(cat);
    if (onSelect) onSelect(cat);
    else navigate(`/courses?category=${encodeURIComponent(cat)}`);
  };

  const renderTag = (t: Topic) => {
    const cat = t.category ?? t.label;
    return (
      <button
        key={t.label}
        className={`topic-tag${selected === cat ? " topic-tag--active" : ""}`}
        onClick={() => handleSelect(t)}
      >
        {t.label}
      </button>
    );
  };

  return (
    <section className="topic-section">
      <div className="topic-container">
        <h2 className="topic-heading">{title}</h2>

        <div className="topic-slider-wrap">
          {/* Viewport */}
          <div className="topic-viewport" ref={outerRef}>
            {/*
              1 grid duy nhất:
              - columns: lặp lại `half` cột bằng nhau
              - rows: 2 hàng cố định
              - items fill theo cột (column-major order) nhờ grid-auto-flow: column
            */}
            <div
              className="topic-grid"
              style={{
                gridTemplateColumns: `repeat(${half}, 1fr)`,
                transform: `translateX(-${offset}px)`,
              }}
            >
              {/* Hàng 1 */}
              {row1.map(renderTag)}
              {/* Hàng 2 — padding nếu row2 ngắn hơn */}
              {row2.map(renderTag)}
              {row2.length < row1.length && (
                <div className="topic-tag topic-tag--placeholder" aria-hidden />
              )}
            </div>
          </div>

          {/* Fade + arrows */}
          {canNext && <div className="topic-fade topic-fade--right" />}
          {canPrev && <div className="topic-fade topic-fade--left" />}

          {canNext && (
            <button
              className="topic-arrow topic-arrow--right"
              onClick={() => setPage((p) => p + 1)}
              aria-label="Scroll right"
            >›</button>
          )}
          {canPrev && (
            <button
              className="topic-arrow topic-arrow--left"
              onClick={() => setPage((p) => p - 1)}
              aria-label="Scroll left"
            >‹</button>
          )}
        </div>
      </div>
    </section>
  );
}

export default TopicSlider;