import type { Config } from "tailwindcss";

/**
 * Thème HBC-RH — porté du design system `hbc-brand.css`.
 * Palette échantillonnée sur le logo : bleu #3C5EA5 / orange #EC7123.
 */
const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#3C5EA5",
          dark: "#2D467B",
          deep: "#1C2F57",
          soft: "#EEF2FA",
        },
        accent: {
          DEFAULT: "#EC7123",
          dark: "#C8601D",
          soft: "#FCECDD",
        },
        ink: "#1F2733",
        muted: "#5C6675",
        line: "#E7EBF2",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "26px",
      },
      boxShadow: {
        "hbc-sm": "0 6px 18px rgba(28,50,94,.07)",
        hbc: "0 14px 38px rgba(28,50,94,.10)",
        "hbc-lg": "0 26px 60px rgba(28,50,94,.16)",
      },
      transitionTimingFunction: {
        hbc: "cubic-bezier(.22,.61,.36,1)",
      },
      maxWidth: {
        container: "1200px",
      },
      keyframes: {
        "float-slow": {
          "0%,100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-18px) scale(1.04)" },
        },
      },
      animation: {
        "float-slow": "float-slow 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
