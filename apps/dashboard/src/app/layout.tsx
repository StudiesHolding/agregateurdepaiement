import type { Metadata } from "next";
import { QueryProvider } from "@/components/providers/QueryProvider";
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
                <QueryProvider>{children}</QueryProvider>
            </body>
        </html>
    );
}
