"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-text-muted hover:text-primary hover:bg-white/10 transition-all duration-300 shadow-inner active:scale-95"
      aria-label="Toggle theme"
    >
      <div className="absolute inset-0 rounded-2xl bg-primary/20 opacity-0 blur-lg transition-opacity group-hover:opacity-100 hidden dark:block" />
      {theme === "dark" ? (
        <Sun className="h-5 w-5 transition-transform group-hover:rotate-180 duration-500 relative z-10" />
      ) : (
        <Moon className="h-5 w-5 transition-transform group-hover:-rotate-12 duration-500 relative z-10" />
      )}
    </button>
  );
}
