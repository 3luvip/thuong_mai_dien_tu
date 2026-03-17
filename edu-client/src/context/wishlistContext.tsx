
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axiosInstance from "../lib/axios";
import { useToast } from "./toast";

interface WishlistCourse {
  id:           string;
  title:        string;
  author:       string;
  price:        number;
  currentPrice: number | null;
  level:        string;
  category:     string;
  path:         string;
  addedAt:      string;
}

interface WishlistContextType {
  items:              WishlistCourse[];
  ids:                Set<string>;          // Set để check O(1)
  total:              number;
  loading:            boolean;
  fetchWishlist:      (userId: string) => Promise<void>;
  addToWishlist:      (userId: string, courseId: string, courseTitle?: string) => Promise<void>;
  removeFromWishlist: (userId: string, courseId: string, courseTitle?: string) => Promise<void>;
  toggleWishlist:     (userId: string, courseId: string, courseTitle?: string) => Promise<void>;
  isWishlisted:       (courseId: string) => boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [items,   setItems]   = useState<WishlistCourse[]>([]);
  const [ids,     setIds]     = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/wishlist/${userId}`);
      const courses: WishlistCourse[] = res.data.courses ?? [];
      setItems(courses);
      setIds(new Set(courses.map((c) => c.id)));
    } catch (err) {
      console.error("Fetch wishlist error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToWishlist = useCallback(async (userId: string, courseId: string, title?: string) => {
    // Optimistic UI
    setIds((prev) => new Set(prev).add(courseId));
    try {
      await axiosInstance.post("/wishlist/add", { user_id: userId, course_id: courseId });
      toast.success("Đã thêm vào yêu thích ❤️", title);
      // Refetch để lấy full data
      await fetchWishlist(userId);
    } catch (err: unknown) {
      // Rollback
      setIds((prev) => { const s = new Set(prev); s.delete(courseId); return s; });
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Không thể thêm vào yêu thích.";
      toast.error("Thêm thất bại", msg);
    }
  }, [fetchWishlist, toast]);

  const removeFromWishlist = useCallback(async (userId: string, courseId: string, title?: string) => {
    // Optimistic UI
    setIds((prev) => { const s = new Set(prev); s.delete(courseId); return s; });
    setItems((prev) => prev.filter((c) => c.id !== courseId));
    try {
      await axiosInstance.delete("/wishlist/remove", { data: { user_id: userId, course_id: courseId } });
      toast.info("Đã xóa khỏi yêu thích", title);
    } catch (err: unknown) {
      // Rollback
      await fetchWishlist(userId);
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Không thể xóa.";
      toast.error("Xóa thất bại", msg);
    }
  }, [fetchWishlist, toast]);

  const toggleWishlist = useCallback(async (userId: string, courseId: string, title?: string) => {
    if (ids.has(courseId)) {
      await removeFromWishlist(userId, courseId, title);
    } else {
      await addToWishlist(userId, courseId, title);
    }
  }, [ids, addToWishlist, removeFromWishlist]);

  const isWishlisted = useCallback((courseId: string) => ids.has(courseId), [ids]);

  return (
    <WishlistContext.Provider value={{
      items, ids, total: items.length, loading,
      fetchWishlist, addToWishlist, removeFromWishlist, toggleWishlist, isWishlisted,
    }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextType {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}