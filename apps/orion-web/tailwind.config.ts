import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          muted: "var(--surface-muted)",
        },
        border: { DEFAULT: "var(--border)" },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-fg)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
} satisfies Config;
