// src/context/CartProvider.tsx
// CartProvider giờ dùng useToast — phải nằm trong <ToastProvider>

import React, { useState, useCallback } from "react";
import { CartContext } from "./cartContext";
import type { Course } from "./cartContext";
import axiosInstance from "../lib/axios";
import { useToast } from "./toast";

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<Course[]>([]);
  const toast = useToast();

  const fetchCart = useCallback(async (userId: string) => {
    try {
      const res = await axiosInstance.get(`/courseCreation/get-cart/${userId}`);
      setCartItems(res.data.courses ?? []);
    } catch (err) {
      console.error("Error fetching cart:", err);
    }
  }, []);

  const addToCart = useCallback(async (userId: string, courseId: string) => {
    // Đã có trong giỏ
    if (cartItems.some((c) => c.id === courseId)) {
      toast.info("Đã có trong giỏ hàng", "Khóa học này đã được thêm trước đó.");
      return;
    }
    try {
      const res = await axiosInstance.post("/courseCreation/add-cart", { user_id: userId, course_id: courseId });
      if (res.status === 200 || res.status === 201) {
        await fetchCart(userId);
        toast.success("Thêm vào giỏ hàng!", "Khóa học đã được thêm vào giỏ hàng của bạn.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Không thể thêm vào giỏ hàng.";
      toast.error("Thêm thất bại", msg);
    }
  }, [cartItems, fetchCart, toast]);

  const removeFromCart = useCallback(async (userId: string, courseId: string) => {
    try {
      await axiosInstance.delete("/courseCreation/remove-cart", {
        data: { user_id: userId, course_id: courseId },
      });
      setCartItems((prev) => prev.filter((c) => c.id !== courseId));
      toast.info("Đã xóa khỏi giỏ hàng");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Không thể xóa khỏi giỏ hàng.";
      toast.error("Xóa thất bại", msg);
    }
  }, [toast]);

  const clearCart = useCallback(async (userId: string) => {
    try {
      await axiosInstance.delete(`/courseCreation/clear-cart/${userId}`);
      setCartItems([]);
      toast.info("Đã xóa toàn bộ giỏ hàng");
    } catch (err: unknown) {
      toast.error("Không thể xóa giỏ hàng");
    }
  }, [toast]);

  return (
    <CartContext.Provider value={{ cartItems, fetchCart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};