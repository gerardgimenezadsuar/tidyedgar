import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        panel: "#12151c",
        panel2: "#1a1e28",
        edge: "#252a36",
        accent: "#5b8def",
        accent2: "#9b6bff",
        pos: "#3ecf8e",
        neg: "#ef4444",
        muted: "#7d8694",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Helvetica", "Arial"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas"],
      },
    },
  },
  plugins: [],
};
export default config;
