import { useEffect, useState } from "react";
import axiosInstance from "../lib/axios";

/** courseId từ GET /learning/my-courses/:userId (đơn paid). */
export function usePurchasedCourseIds(userId: string | null): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!userId) {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    const load = () => {
      axiosInstance
        .get<{ courses?: Array<{ courseId: string }> }>(
          `/learning/my-courses/${userId}`,
        )
        .then((res) => {
          if (cancelled) return;
          const list = res.data.courses ?? [];
          setIds(
            new Set(
              list.map((c) => c.courseId).filter((x): x is string => Boolean(x)),
            ),
          );
        })
        .catch(() => {
          if (!cancelled) setIds(new Set());
        });
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);

  return ids;
}
