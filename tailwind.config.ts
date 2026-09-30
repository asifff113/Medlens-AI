import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f6f7f9",
          100: "#eceff3",
          200: "#d4dae3",
          300: "#aab4c3",
          400: "#7b889a",
          500: "#536276",
          600: "#3b4a5d",
          700: "#2a374a",
          800: "#1c2533",
          900: "#0f1622",
        },
        accent: {
          50: "#eef7f4",
          100: "#d6ede4",
          500: "#1f8f6b",
          600: "#15704f",
          700: "#0f5538",
        },
        warn: {
          500: "#c2410c",
          600: "#9a330a",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;