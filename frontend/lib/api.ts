import axios from "axios";
import { clearAuthUser } from "@/lib/auth";

const ENABLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

export const api = axios.create({
  baseURL: "/",
  timeout: 90000,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (ENABLE_AUTH && error?.response?.status === 401) {
      clearAuthUser();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
