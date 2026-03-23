import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("b2b_token")?.value;

  // Pattern to match dashboard routes
  const isDashboardRoute = /^\/(?:[a-z]{2})\/dashboard/.test(pathname);
  const isLoginRoute = /^\/(?:[a-z]{2})\/login/.test(pathname);

  // 1. If trying to access dashboard without token, redirect to login
  if (isDashboardRoute && !token) {
    const locale = pathname.split("/")[1] || defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If trying to access login with a token, redirect to dashboard
  if (isLoginRoute && token) {
    const locale = pathname.split("/")[1] || defaultLocale;
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Handle i18n
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
