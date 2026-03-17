"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const languages = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
    setOpen(false);
  };

  const currentLang = languages.find((l) => l.code === locale);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="group flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-text-muted hover:text-primary hover:bg-white/10 transition-all duration-300 shadow-inner active:scale-95"
        aria-label="Switch language"
      >
        <Globe className="h-5 w-5 group-hover:rotate-12 transition-transform" />
        <span className="text-xs uppercase tracking-widest">{currentLang?.code}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 w-44 rounded-[22px] border border-white/10 bg-surface/80 backdrop-blur-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200 z-50 overflow-hidden p-1.5">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => switchLocale(lang.code)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3 text-xs font-bold transition-all duration-200 rounded-2xl mb-1 last:mb-0",
                locale === lang.code
                  ? "bg-primary text-white shadow-glow-sm"
                  : "text-text-light hover:bg-white/5 hover:text-text-main"
              )}
            >
              <div className="flex items-center gap-3">
                 <span className="text-lg">{lang.flag}</span>
                 <span className="uppercase tracking-widest">{lang.label}</span>
              </div>
              {locale === lang.code && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
