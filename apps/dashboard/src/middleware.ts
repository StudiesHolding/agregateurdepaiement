import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Middleware for route protection
 * Ensures only authenticated sessions can access the dashboard routes.
 */
export default auth((req) => {
    const isAuth = !!req.auth;
    const isLoginPage = req.nextUrl.pathname.startsWith("/login");

    if (isLoginPage) {
        if (isAuth) {
            return NextResponse.redirect(new URL("/", req.nextUrl));
        }
        return null;
    }

    if (!isAuth) {
        let from = req.nextUrl.pathname;
        if (req.nextUrl.search) {
            from += req.nextUrl.search;
        }

        return NextResponse.redirect(
            new URL(`/login?from=${encodeURIComponent(from)}`, req.nextUrl)
        );
    }

    // Inject session details or headers if needed here
});

export const config = {
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
