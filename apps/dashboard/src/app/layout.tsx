import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SessionProvider } from "next-auth/react";
import { SessionTimeoutProvider } from "@/components/providers/SessionTimeoutProvider";
import { Toaster } from "sonner";
import "@/app/globals.css";

export const metadata: Metadata = {
    title: { default: "Studies Learning · Paiements", template: "%s · Studies Learning Paiements" },
    description: "Espace finance de Studies Learning : prestataires de paiement, règles de priorité, revenus, échecs et supervision.",
    icons: {
        icon: [{ url: "/brand/monogram-violet-32.png", sizes: "32x32" }, { url: "/brand/monogram-violet-16.png", sizes: "16x16" }],
        apple: "/brand/app-violet-180.png",
    },
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <head>
                <link
                    rel="preconnect"
                    href="https://fonts.googleapis.com"
                    crossOrigin="anonymous"
                />
                <link
                    rel="preconnect"
                    href="https://fonts.gstatic.com"
                    crossOrigin="anonymous"
                />
            </head>
            <body>
                <SessionProvider>
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                            <SessionTimeoutProvider>
                                <QueryProvider>{children}</QueryProvider>
                                <Toaster position="top-right" richColors closeButton />
                            </SessionTimeoutProvider>
                    </ThemeProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
