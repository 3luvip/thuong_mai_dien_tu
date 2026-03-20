import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../style/components/_topic_slider.scss";

interface Topic {
  label: string;
  /** Category chính — dùng để filter ?category= */
  category?: string;
  /** Keyword bổ sung — nếu có thì append ?keyword= vào URL */
  keyword?: string;
}

interface TopicSliderProps {
  title?: string;
  topics?: Topic[];
  onSelect?: (url: string) => void;
}

const DEFAULT_TOPICS: Topic[] = [
  // ── Danh mục rộng → chỉ dùng category ────────────────────────────────────
  { label: "Web Development",       category: "Web Development" },
  { label: "AI / Machine Learning", category: "AI" },
  { label: "Blockchain",            category: "BlockChain" },
  { label: "App Development",       category: "App Development" },
  { label: "Data Science",          category: "Data Science" },

  // ── Công nghệ cụ thể → dùng keyword để tìm trong title/sub ───────────────
  { label: "Python",      keyword: "Python" },
  { label: "React",       keyword: "React" },
  { label: "Node.js",     keyword: "Node" },
  { label: "Solidity",    keyword: "Solidity",  category: "BlockChain" },
  { label: "Flutter",     keyword: "Flutter",   category: "App Development" },
  { label: "Docker / K8s",keyword: "Docker" },
  { label: "Deep Learning",keyword: "Deep Learning", category: "AI" },
];

// Số cột hiển thị cùng lúc
const COLS = 6;

function TopicSlider({
  title = "Topics recommended for you",
  topics = DEFAULT_TOPICS,
  onSelect,
}: TopicSliderProps) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const outerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Build URL từ topic
  const buildUrl = (topic: Topic): string => {
    const params = new URLSearchParams();
    if (topic.category) params.set("category", topic.category);
    if (topic.keyword)  params.set("keyword",  topic.keyword);
    return `/courses?${params.toString()}`;
  };

  const handleSelect = (topic: Topic) => {
    setSelectedLabel(topic.label);
    const url = buildUrl(topic);
    if (onSelect) onSelect(url);
    else navigate(url);
  };

  // Chia 2 hàng
  const half = Math.ceil(topics.length / 2);
  const row1 = topics.slice(0, half);
  const row2 = topics.slice(half);

  const totalPages = Math.ceil(half / COLS);
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  const colWidth = outerRef.current
    ? outerRef.current.clientWidth / COLS
    : 0;
  const offset = page * COLS * colWidth;

  const renderTag = (t: Topic) => (
    <button
      key={t.label}
      className={`topic-tag${selectedLabel === t.label ? " topic-tag--active" : ""}`}
      onClick={() => handleSelect(t)}
    >
      {t.label}
    </button>
  );

  return (
    <section className="topic-section">
      <div className="topic-container">
        <h2 className="topic-heading">{title}</h2>

        <div className="topic-slider-wrap">
          <div className="topic-viewport" ref={outerRef}>
            <div
              className="topic-grid"
              style={{
                gridTemplateColumns: `repeat(${half}, 1fr)`,
                transform: `translateX(-${offset}px)`,
              }}
            >
              {row1.map(renderTag)}
              {row2.map(renderTag)}
              {row2.length < row1.length && (
                <div className="topic-tag topic-tag--placeholder" aria-hidden />
              )}
            </div>
          </div>

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