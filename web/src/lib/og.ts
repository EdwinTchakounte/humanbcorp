import type { Metadata } from "next";

import type { Lang } from "@/lib/api";

/**
 * Socle Open Graph à réutiliser dans CHAQUE page qui définit `openGraph`.
 *
 * Next ne fusionne pas les métadonnées en profondeur : dès qu'une page fournit
 * une clé `openGraph`, celle du layout racine est **remplacée**, pas complétée.
 * Une page qui ne posait qu'une image perdait donc og:type, og:site_name et
 * og:locale ; et `openGraph: undefined` — la clé présente, mais vide — effaçait
 * tout le bloc, laissant la page d'accueil sans le moindre aperçu au partage.
 *
 * D'où ce socle : on repart des valeurs du site, puis on écrase ce qui est propre
 * à la page.
 */
export const OG_IMAGE_DEFAUT = "/brand/logo.png";

export function ogBase(lang: Lang): NonNullable<Metadata["openGraph"]> {
  return {
    ...socleSansImage(lang),
    images: [OG_IMAGE_DEFAUT],
  };
}

/**
 * Même socle, sans image — à utiliser sur les pages qui ont un
 * `opengraph-image.tsx`.
 *
 * Une image posée dans `generateMetadata` l'emporte sur la convention de
 * fichier : poser le logo ici neutraliserait la vignette générée, sans que rien
 * ne le signale.
 */
export function socleSansImage(lang: Lang): NonNullable<Metadata["openGraph"]> {
  return {
    type: "website",
    locale: lang === "en" ? "en_US" : "fr_FR",
    siteName: "Human Brain Corporation-RH",
  };
}
