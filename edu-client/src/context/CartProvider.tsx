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
      toast.info("Already in cart", "This course was added earlier.");
      return;
    }
    try {
      const res = await axiosInstance.post("/courseCreation/add-cart", { user_id: userId, course_id: courseId });
      if (res.status === 200 || res.status === 201) {
        await fetchCart(userId);
        toast.success("Added to cart!", "The course has been added to your cart.");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Unable to add to cart.";
      toast.error("Add failed", msg);
    }
  }, [cartItems, fetchCart, toast]);

  const removeFromCart = useCallback(async (userId: string, courseId: string) => {
    try {
      await axiosInstance.delete("/courseCreation/remove-cart", {
        data: { user_id: userId, course_id: courseId },
      });
      setCartItems((prev) => prev.filter((c) => c.id !== courseId));
      toast.info("Removed from cart");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
                    ?.response?.data?.message ?? "Unable to remove from cart.";
      toast.error("Remove failed", msg);
    }
  }, [toast]);

  const clearCart = useCallback(async (userId: string) => {
    try {
      await axiosInstance.delete(`/courseCreation/clear-cart/${userId}`);
      setCartItems([]);
      toast.info("Cart cleared");
    } catch (err: unknown) {
      toast.error("Unable to clear cart");
    }
  }, [toast]);

  return (
    <CartContext.Provider value={{ cartItems, fetchCart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};