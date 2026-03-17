import { createContext } from "react";

// ✅ FIX: backend trả về "id" không phải "_id"
export interface Course {
  id: string;          // courses.id (UUID)
  title: string;
  author: string;
  price: string | number;
  level: string;
  catogory?: string;
  category?: string;
  path: string;
  currentPrice?: string | number;
}

export interface CartContextType {
  cartItems: Course[];
  fetchCart: (userId: string) => Promise<void>;
  addToCart: (userId: string, courseId: string) => Promise<void>;
  removeFromCart: (userId: string, courseId: string) => Promise<void>;
  clearCart: (userId: string) => Promise<void>;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);