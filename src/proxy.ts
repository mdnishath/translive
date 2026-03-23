import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "translive-super-secret-jwt-key-2026-change-in-production"
);

const PUBLIC_PATHS = ["/login", "/signup", "/api/auth/login", "/api/auth/signup"];
// API routes handle their own auth (getAuthUser supports both cookies AND Bearer tokens)
// so we skip all /api/ routes here to allow mobile apps with Bearer auth to work
const API_PREFIX = "/api/";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow all API routes — they handle their own auth (Bearer + cookie)
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // Allow Next.js internals & static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
