import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        screens: {
            sm: "640px",
            md: "768px",
            lg: "1024px",
            xl: "1280px",
        },
        extend: {
            fontFamily: {
                sans: ["var(--font-sans)"],
            },
            fontSize: {
                sm: ["var(--font-size-sm)", { lineHeight: "var(--line-height-sm)" }],
                base: ["var(--font-size-base)", { lineHeight: "var(--line-height-base)" }],
                lg: ["var(--font-size-lg)", { lineHeight: "var(--line-height-lg)" }],
                xl: ["var(--font-size-xl)", { lineHeight: "var(--line-height-xl)" }],
                "2xl": ["var(--font-size-2xl)", { lineHeight: "var(--line-height-2xl)" }],
                "3xl": ["var(--font-size-3xl)", { lineHeight: "var(--line-height-3xl)" }],
                "4xl": ["var(--font-size-4xl)", { lineHeight: "var(--line-height-4xl)" }],
                "5xl": ["var(--font-size-5xl)", { lineHeight: "var(--line-height-5xl)" }],
                "6xl": ["var(--font-size-6xl)", { lineHeight: "var(--line-height-6xl)" }],
            },
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)",
                },
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)",
                },
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                success: {
                    DEFAULT: "var(--success)",
                    foreground: "var(--success-foreground)",
                },
                warning: {
                    DEFAULT: "var(--warning)",
                    foreground: "var(--warning-foreground)",
                },
                danger: {
                    DEFAULT: "var(--danger)",
                    foreground: "var(--danger-foreground)",
                },
                chart: {
                    "1": "var(--chart-1)",
                    "2": "var(--chart-2)",
                    "3": "var(--chart-3)",
                    "4": "var(--chart-4)",
                    "5": "var(--chart-5)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
export default config;
