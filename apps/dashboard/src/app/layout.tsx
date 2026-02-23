import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
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
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                    <I18nProvider>
                        <QueryProvider>{children}</QueryProvider>
                    </I18nProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
