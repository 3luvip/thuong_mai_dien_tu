import axios from "axios";
import { session } from "./storage";

const axiosInstance = axios.create({
  baseURL: "http://localhost:8080",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = session.getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Các URL auth — KHÔNG redirect tự động, để component tự xử lý
    const url = error.config?.url ?? "";
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/signup") ||
      url.includes("/auth/verify");

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    if (status === 401) {
      // Token hết hạn hoặc invalid — logout tab này
      session.clear();
      window.location.href = "/#/login";
    }

    if (status === 403) {
      // Tài khoản bị ban giữa chừng
      session.clear();
      window.location.href = "/#/banned";
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;