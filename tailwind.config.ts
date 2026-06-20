import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}","./lib/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)","serif"],
        body: ["var(--font-body)","sans-serif"],
        mono: ["var(--font-mono)","monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
