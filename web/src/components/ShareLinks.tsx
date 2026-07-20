"use client";

import { useState } from "react";

import type { Lang } from "@/lib/api";

/**
 * Partage d'un contenu (offre d'emploi, formation…) vers WhatsApp / Facebook /
 * LinkedIn, plus copie du lien.
 *
 * Ces plateformes ne relaient qu'une URL : c'est le flyer généré par
 * `opengraph-image.tsx` qui fournit l'aperçu visuel. On ne joint donc pas
 * d'image ici — on partage le lien, et l'aperçu se compose tout seul.
 *
 * WhatsApp fait exception : il n'accepte pas de texte pré-rempli via un simple
 * lien de partage, mais `wa.me/?text=` permet d'y glisser l'accroche + l'URL,
 * ce qui donne un message déjà écrit à l'expéditeur.
 */
const L = {
  fr: {
    titre: "Partager",
    copier: "Copier le lien",
    copie: "Lien copié",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    linkedin: "LinkedIn",
  },
  en: {
    titre: "Share",
    copier: "Copy link",
    copie: "Link copied",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    linkedin: "LinkedIn",
  },
} as const;

export default function ShareLinks({
  url,
  message,
  lang,
  titre,
}: {
  url: string;
  message: string;
  lang: Lang;
  /** Intitulé affiché au-dessus des boutons (défaut : « Partager »). */
  titre?: string;
}) {
  const t = L[lang];
  const [copie, setCopie] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message}\n${url}`)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers indisponible (http, permissions) : on n'alerte pas */
    }
  }

  const lien =
    "inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand";

  return (
    <div className="mt-8 border-t border-line pt-6">
      <p className="eyebrow">{titre ?? t.titre}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={lien}>
          <i className="bx bxl-whatsapp text-lg text-[#25D366]" /> {t.whatsapp}
        </a>
        <a href={facebook} target="_blank" rel="noopener noreferrer" className={lien}>
          <i className="bx bxl-facebook-circle text-lg text-[#1877F2]" /> {t.facebook}
        </a>
        <a href={linkedin} target="_blank" rel="noopener noreferrer" className={lien}>
          <i className="bx bxl-linkedin-square text-lg text-[#0A66C2]" /> {t.linkedin}
        </a>
        <button type="button" onClick={copier} className={lien}>
          <i className={`bx ${copie ? "bx-check text-green-600" : "bx-link"} text-lg`} />
          {copie ? t.copie : t.copier}
        </button>
      </div>
    </div>
  );
}
