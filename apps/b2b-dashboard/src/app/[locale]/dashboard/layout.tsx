import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/providers/SidebarProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background relative selection:bg-primary/20 selection:text-primary-700 dark:selection:text-primary-300">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/4 right-0 h-[600px] w-[80%] rounded-full bg-primary/5 blur-3xl pointer-events-none z-0" />
        <div className="absolute bottom-0 right-1/4 left-0 h-[400px] w-[60%] rounded-full bg-secondary/5 blur-3xl pointer-events-none z-0" />
        
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden relative z-10">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
