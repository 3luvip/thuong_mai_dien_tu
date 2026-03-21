import { useState } from "react";
import { IoHeart, IoHeartOutline } from "react-icons/io5";
import { useWishlist } from "../../context/wishlistContext";

interface HeartButtonProps {
  courseId:    string;
  userId:      string | null;
  courseTitle?: string;
  size?:       number;
  className?:  string;
}

export default function HeartButton({
  courseId, userId, courseTitle, size = 20,
}: HeartButtonProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [animating, setAnimating]        = useState(false);

  const wishlisted = isWishlisted(courseId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;

    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    await toggleWishlist(userId, courseId, courseTitle);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!userId}
        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        title={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
        style={{
          background:    wishlisted ? "rgba(244,63,94,0.15)" : "rgba(15,23,42,0.7)",
          border:        wishlisted ? "1px solid rgba(244,63,94,0.35)" : "1px solid rgba(148,163,184,0.2)",
          borderRadius:  "50%",
          width:         size + 16,
          height:        size + 16,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
          cursor:        userId ? "pointer" : "not-allowed",
          backdropFilter:"blur(4px)",
          transition:    "all 0.2s ease",
          color:         wishlisted ? "#f43f5e" : "#94a3b8",
          fontSize:      size,
          transform:     animating ? "scale(1.3)" : "scale(1)",
          padding:       0,
        }}
      >
        {wishlisted
          ? <IoHeart  style={{ display: "block" }} />
          : <IoHeartOutline style={{ display: "block" }} />
        }
      </button>

      <style>{`
        @keyframes heart-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.4); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}