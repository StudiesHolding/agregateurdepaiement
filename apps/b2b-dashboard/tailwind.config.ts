import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Studies Learning B2B Design Tokens
        primary: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          DEFAULT: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        secondary: {
          DEFAULT: "#0ea5e9",
          light: "#e0f2fe",
          dark: "#0369a1",
        },
        success: {
          DEFAULT: "#10b981",
          light: "#d1fae5",
          dark: "#065f46",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fef3c7",
          dark: "#92400e",
        },
        danger: {
          DEFAULT: "#ef4444",
          light: "#fee2e2",
          dark: "#7f1d1d",
        },
        surface: "var(--color-surface)",
        background: "var(--color-background)",
        border: "var(--color-border)",
        "text-main": "var(--color-text-main)",
        "text-light": "var(--color-text-light)",
        "text-muted": "var(--color-text-muted)",
        sidebar: {
          bg: "var(--sidebar-bg)",
          hover: "var(--sidebar-hover)",
          active: "var(--sidebar-active)",
          text: "var(--sidebar-text)",
          "text-active": "var(--sidebar-text-active)",
          border: "var(--sidebar-border)",
        },
      },
      fontFamily: {
        sans: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(0, 0, 0, 0.08)",
        "card-hover": "0 12px 40px -8px rgba(0, 0, 0, 0.14)",
        glow: "0 0 20px 0 rgba(79, 70, 229, 0.25)",
        "glow-success": "0 0 20px 0 rgba(16, 185, 129, 0.25)",
        "glow-danger": "0 0 20px 0 rgba(239, 68, 68, 0.25)",
        "inner-sm": "inset 0 1px 2px rgba(0, 0, 0, 0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "count-up": "countUp 1s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #4f46e5, #0ea5e9)",
        "gradient-success": "linear-gradient(135deg, #10b981, #34d399)",
        "gradient-danger": "linear-gradient(135deg, #ef4444, #f97316)",
        "gradient-surface":
          "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        "gradient-dark":
          "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
