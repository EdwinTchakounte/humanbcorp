import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#3C5EA5", dark: "#2D467B", deep: "#1C2F57", soft: "#EEF2FA" },
        accent: { DEFAULT: "#EC7123", dark: "#C8601D" },
        ink: "#1F2733",
        muted: "#5C6675",
        line: "#E7EBF2",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "hbc-sm": "0 6px 18px rgba(28,50,94,.07)",
        hbc: "0 14px 38px rgba(28,50,94,.10)",
      },
    },
  },
  plugins: [],
};
export default config;
