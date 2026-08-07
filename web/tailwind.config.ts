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
        ink: "#1A2230",
        muted: "#5A6577",
        line: "#DCE2EC",
        // Filet plus fin/discret pour les séparations secondaires (raffinement).
        hairline: "#E7EBF2",
        // Fond « papier » chaud pour alterner discrètement les sections : neutre
        // légèrement chaud (haut de gamme) qui réchauffe le bleu institutionnel.
        paper: "#F6F5F2",
        // Canvas : blanc cassé chaud, base du body (évite le blanc clinique #fff).
        canvas: "#FCFBFA",
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Échelle d'affichage fluide (clamp) pour les titres héros : impact premium
      // sans casse à petits écrans. Tracking resserré, graisse forte.
      fontSize: {
        display: ["clamp(2.5rem, 5.2vw, 4.25rem)", { lineHeight: "1.04", letterSpacing: "-0.032em", fontWeight: "800" }],
        "display-lg": ["clamp(3rem, 6.5vw, 5.25rem)", { lineHeight: "1.02", letterSpacing: "-0.035em", fontWeight: "800" }],
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
      // Ombres douces en COUCHES : profondeur premium (proche + diffuse) au lieu
      // d'un flou plat unique. On garde une base légère fidèle à l'ADN net.
      boxShadow: {
        "hbc-sm": "0 1px 2px rgba(26,34,48,.05), 0 1px 1px rgba(26,34,48,.03)",
        hbc: "0 2px 4px -1px rgba(26,34,48,.05), 0 12px 24px -6px rgba(28,50,94,.10)",
        "hbc-lg": "0 8px 12px -4px rgba(28,50,94,.08), 0 30px 60px -12px rgba(28,50,94,.18)",
        // Carte au repos (subtile) et lévitation au survol.
        "hbc-card": "0 1px 3px rgba(26,34,48,.04), 0 10px 30px -12px rgba(28,50,94,.12)",
        "hbc-hover": "0 10px 20px -6px rgba(28,50,94,.10), 0 30px 50px -14px rgba(28,50,94,.20)",
        // Halo coloré sous les CTA au survol (accent chaleureux).
        "hbc-glow": "0 10px 30px -8px rgba(236,113,35,.45)",
        "hbc-glow-brand": "0 10px 30px -8px rgba(60,94,165,.40)",
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
