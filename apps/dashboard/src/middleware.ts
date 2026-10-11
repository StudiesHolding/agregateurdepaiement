import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

/**
 * Middleware for route protection
 * Ensures only authenticated sessions can access the dashboard routes.
 */
export default auth((req) => {
  // Une session valide a un utilisateur. En cas d'erreur de configuration, Auth.js renvoie un objet d'erreur
  // ({ message }) : ne jamais le prendre pour une session (fermé par défaut, ADR-0018 D5).
  const isAuth = !!(req.auth as { user?: unknown } | null)?.user;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");

  if (isLoginPage) {
    if (isAuth) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    let from = req.nextUrl.pathname;
    if (req.nextUrl.search) {
      from += req.nextUrl.search;
    }

    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, req.nextUrl),
    );
  }

  // Inject session details or headers if needed here
  return NextResponse.next();
});

export const config = {
  // Fichiers publics (marque, icônes) servis sans session : la page de connexion les affiche.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand/).*)"],
};
