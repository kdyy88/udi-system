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
      // Don't redirect when already on the login page or when the request
      // itself is the login endpoint — let the form handle the error inline.
      const requestUrl: string = error?.config?.url ?? "";
      const onLoginPage =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/login");
      const isLoginEndpoint = requestUrl.includes("/auth/login");

      if (!onLoginPage && !isLoginEndpoint) {
        clearAuthUser();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  },
);
