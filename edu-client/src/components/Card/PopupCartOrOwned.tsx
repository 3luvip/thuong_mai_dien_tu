import type { ReactNode } from "react";
import { Link } from "react-router-dom";

type CourseRef = {
  id: string;
  instructorId?: string;
};

interface PopupCartOrOwnedProps {
  course: CourseRef;
  userId: string | null;
  purchasedIds: Set<string>;
  onAddToCart: () => void;
  /** class nút giỏ (vd. tabs-popup__cart) */
  cartClassName?: string;
  children?: ReactNode;
}

/**
 * Trong popup hover: đã mua → nhắn + Continue learning; chủ khóa → nhắn; còn lại → Add to cart.
 */
export default function PopupCartOrOwned({
  course,
  userId,
  purchasedIds,
  onAddToCart,
  cartClassName = "tabs-popup__cart",
  children,
}: PopupCartOrOwnedProps) {
  const owned = purchasedIds.has(course.id);
  const isInstructor =
    !!userId && !!course.instructorId && course.instructorId === userId;

  if (owned) {
    return (
      <div className="tabs-popup__cart-owned">
        <span className="tabs-popup__cart-owned-msg">You already own this course</span>
        <Link to={`/learn/${course.id}`} className={cartClassName}>
          Continue learning
        </Link>
      </div>
    );
  }

  if (isInstructor) {
    return (
      <div className="tabs-popup__cart-owned">
        <span className="tabs-popup__cart-owned-msg tabs-popup__cart-owned-msg--muted">
          Your course — open the detail page to manage
        </span>
      </div>
    );
  }

  return (
    <button type="button" className={cartClassName} onClick={onAddToCart}>
      {children}
    </button>
  );
}
