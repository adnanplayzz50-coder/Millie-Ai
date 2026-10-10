import { Outlet } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { AppProvider, useApp } from "@/components/app/AppProvider";
import { Sidebar } from "./Sidebar";
import { CustomizeSheet } from "./CustomizeSheet";
import { CommandPalette } from "./CommandPalette";
import { OnboardingDialog } from "./OnboardingDialog";
import { WakeWordProvider } from "./WakeWord";
import { cn } from "@/lib/utils";

export function AppShell({ user }: { user: User }) {
  return (
    <AppProvider user={user}>
      <WakeWordProvider>
        <Layout />
      </WakeWordProvider>
    </AppProvider>
  );
}

function Layout() {
  const { sidebarOpen, setSidebarOpen } = useApp();
  return (
    <div className="flex h-dvh overflow-hidden">
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <CustomizeSheet />
      <CommandPalette />
      <OnboardingDialog />
    </div>
  );
}
