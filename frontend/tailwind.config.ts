import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18212f",
        panel: "#f7f8fb",
        line: "#d9dfeb",
        accent: "#1967d2",
        success: "#16794c",
        warning: "#9a5b00"
      }
    }
  },
  plugins: []
};

export default config;
