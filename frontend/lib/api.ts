import axios from "axios";
import { clearAuthUser } from "@/lib/auth";

export const api = axios.create({
  baseURL: "/",
  timeout: 90000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
