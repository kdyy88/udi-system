import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * When ENABLE_AUTH is false (pure-tool mode), redirect all auth pages to "/".
 * When ENABLE_AUTH is true (commercial mode), this proxy is a no-op.
 */
const ENABLE_AUTH = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export function proxy(request: NextRequest) {
  if (!ENABLE_AUTH && AUTH_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"],
};
