const SERVER_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const PLACEHOLDER = "https://s.udemycdn.com/course/750x422/placeholder.jpg";

export function getCourseImageUrl(path: string | undefined | null): string {
  if (!path) return PLACEHOLDER;

  // Đã là full URL
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  // Strip "./" ở đầu: "./uploads/file.png" → "uploads/file.png"
  let normalized = path.startsWith("./") ? path.slice(2) : path;

  // Strip "/" ở đầu: "/uploads/file.png" → "uploads/file.png"
  if (normalized.startsWith("/")) normalized = normalized.slice(1);

  // Kết quả: "http://localhost:8080/uploads/file.png"
  return `${SERVER_BASE}/${normalized}`;
}