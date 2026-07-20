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
        muted: "#586274",
        line: "#DCE2EC",
        // Fond « papier » pour alterner discrètement les sections (institutionnel).
        paper: "#F6F8FC",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Échelle de rayons resserrée : rendu plus institutionnel, net et
      // structuré (on garde une légère douceur, sans angles vifs bruts).
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "6px",
        xl: "8px",
        "2xl": "10px",
        "3xl": "14px",
        full: "9999px",
      },
      // Ombres resserrées : on privilégie les filets (bordures 1px) à la
      // profondeur floue. Rendu architectural, net, institutionnel.
      boxShadow: {
        "hbc-sm": "0 1px 2px rgba(28,50,94,.05)",
        hbc: "0 6px 20px rgba(28,50,94,.07)",
        "hbc-lg": "0 18px 44px rgba(28,50,94,.12)",
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
