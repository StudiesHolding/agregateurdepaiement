/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Studies Learning design tokens
                primary: {
                    DEFAULT: "#4f46e5",
                    dark: "#4338ca",
                    light: "#e0e7ff",
                },
                secondary: {
                    DEFAULT: "#0ea5e9",
                    light: "#e0f2fe",
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
                surface: "#ffffff",
                background: "#f8fafc",
                border: "#e2e8f0",
                "text-main": "#1e293b",
                "text-light": "#64748b",
                // Status specific for provider health
                operational: "#10b981",
                degraded: "#f59e0b",
                critical: "#ef4444",
                inactive: "#94a3b8",
                idle: "#60a5fa",
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
            },
            animation: {
                "fade-in": "fadeIn 0.3s ease-in-out",
                "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                "count-up": "countUp 1s ease-out",
                pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
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
            },
            backgroundImage: {
                "gradient-primary": "linear-gradient(135deg, #4f46e5, #0ea5e9)",
                "gradient-success": "linear-gradient(135deg, #10b981, #34d399)",
                "gradient-danger": "linear-gradient(135deg, #ef4444, #f97316)",
                "gradient-surface": "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            },
        },
    },
    plugins: [],
};
