import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { SessionProvider } from "next-auth/react";
import { SessionTimeoutProvider } from "@/components/providers/SessionTimeoutProvider";
import "@/app/globals.css";

export const metadata: Metadata = {
    title: "Studies PSP — Payment Operations",
    description: "Payment Operations Dashboard — Studies Learning Platform",
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
                        <I18nProvider>
                            <SessionTimeoutProvider>
                                <QueryProvider>{children}</QueryProvider>
                            </SessionTimeoutProvider>
                        </I18nProvider>
                    </ThemeProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
