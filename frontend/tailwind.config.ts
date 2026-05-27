import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"DM Mono"', "ui-monospace", "SF Mono", "monospace"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        border: "hsl(217 20% 24%)",
        input: "hsl(217 20% 18%)",
        ring: "hsl(41 83% 55%)",
        background: "hsl(217 30% 8%)",
        foreground: "hsl(210 20% 92%)",
        panel: "hsl(217 25% 12%)",
        "panel-hover": "hsl(217 25% 16%)",
        primary: {
          DEFAULT: "hsl(41 83% 55%)",
          foreground: "hsl(217 30% 8%)"
        },
        secondary: {
          DEFAULT: "hsl(217 20% 20%)",
          foreground: "hsl(210 20% 85%)"
        },
        muted: {
          DEFAULT: "hsl(217 20% 16%)",
          foreground: "hsl(215 16% 55%)"
        },
        accent: {
          DEFAULT: "hsl(170 60% 45%)",
          foreground: "hsl(217 30% 8%)"
        },
        destructive: {
          DEFAULT: "hsl(0 55% 52%)",
          foreground: "hsl(210 20% 92%)"
        },
        warning: {
          DEFAULT: "hsl(41 83% 55%)",
          foreground: "hsl(217 30% 8%)"
        },
        success: {
          DEFAULT: "hsl(160 50% 48%)",
          foreground: "hsl(217 30% 8%)"
        },
        info: {
          DEFAULT: "hsl(200 60% 52%)",
          foreground: "hsl(210 20% 92%)"
        }
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.25rem",
        sm: "0.125rem"
      },
      boxShadow: {
        panel: "0 1px 3px 0 rgba(0,0,0,0.4), 0 0 0 1px hsl(217 20% 18%)",
        "panel-lg": "0 4px 12px 0 rgba(0,0,0,0.5), 0 0 0 1px hsl(217 20% 20%)"
      }
    }
  },
  plugins: []
} satisfies Config;
