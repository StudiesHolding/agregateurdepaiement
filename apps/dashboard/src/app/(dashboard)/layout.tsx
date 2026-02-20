import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-background">
            {/* Sidebar — fixed, 256px */}
            <Sidebar />

            {/* Main content */}
            <div className="flex-1 ml-64 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 p-6 animate-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );
}
