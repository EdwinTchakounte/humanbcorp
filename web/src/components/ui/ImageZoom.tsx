"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Image agrandissable — pensée pour les énoncés de quiz.
 *
 * Une image d'énoncé (extrait de texte, plan, graphique, capture d'un sujet) est
 * bridée à quelques centaines de pixels dans le flux de la question : c'est la
 * bonne taille pour lire la page, pas pour lire l'image. L'apprenant ne peut pas
 * répondre à ce qu'il ne déchiffre pas, et le zoom du navigateur agrandit toute
 * la page, pas la seule illustration.
 *
 * D'où cette visionneuse : clic → plein écran, molette / boutons → facteur de
 * grossissement, glisser → déplacement quand l'image dépasse. Échap ou clic sur
 * le fond ferment. Volontairement sans dépendance.
 */

const MIN = 1;
const MAX = 5;
const PAS = 0.5;

export default function ImageZoom({
  src,
  alt = "",
  className = "",
  legende,
  declencheur = "vignette",
}: {
  src: string;
  alt?: string;
  className?: string;
  /** Texte affiché sous l'image en plein écran (le libellé de l'option, p. ex.). */
  legende?: string;
  /**
   * Ce sur quoi on clique pour agrandir :
   *  - `vignette` : l'image elle-même (cas de l'énoncé) ;
   *  - `loupe` : un petit bouton seul. Nécessaire dans une grille de réponses en
   *    images, où la vignette est DÉJÀ un bouton — celui qui coche l'option. On
   *    ne peut pas imbriquer deux boutons, et regarder de plus près ne doit pas
   *    valoir réponse.
   */
  declencheur?: "vignette" | "loupe";
}) {
  const [ouvert, setOuvert] = useState(false);
  const [facteur, setFacteur] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [prise, setPrise] = useState<{ x: number; y: number } | null>(null);

  const fermer = useCallback(() => {
    setOuvert(false);
    setFacteur(1);
    setPos({ x: 0, y: 0 });
    setPrise(null);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
      if (e.key === "+" || e.key === "=") setFacteur((f) => Math.min(MAX, f + PAS));
      if (e.key === "-") setFacteur((f) => Math.max(MIN, f - PAS));
    };
    window.addEventListener("keydown", onKey);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = avant;
    };
  }, [ouvert, fermer]);

  return (
    <>
      {declencheur === "loupe" ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={alt ? `Agrandir : ${alt}` : "Agrandir l'image"}
          title="Agrandir l'image"
          className={`flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 ${className}`}
        >
          <i className="bx bx-search-alt text-base" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label={alt ? `Agrandir : ${alt}` : "Agrandir l'image"}
          className="group relative block cursor-zoom-in overflow-hidden rounded-lg"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className={className} />
          <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-80 transition-opacity group-hover:opacity-100">
            <i className="bx bx-search-alt text-base" aria-hidden />
          </span>
        </button>
      )}

      {ouvert && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || "Image agrandie"}
          onClick={fermer}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mb-3 flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1.5 text-white backdrop-blur"
          >
            <button
              onClick={() => setFacteur((f) => Math.max(MIN, f - PAS))}
              disabled={facteur <= MIN}
              aria-label="Réduire"
              className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
            >
              <i className="bx bx-minus text-xl" />
            </button>
            <span className="w-14 text-center text-sm font-semibold tabular-nums">
              {Math.round(facteur * 100)} %
            </span>
            <button
              onClick={() => setFacteur((f) => Math.min(MAX, f + PAS))}
              disabled={facteur >= MAX}
              aria-label="Agrandir"
              className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
            >
              <i className="bx bx-plus text-xl" />
            </button>
            <button
              onClick={() => {
                setFacteur(1);
                setPos({ x: 0, y: 0 });
              }}
              aria-label="Taille d'origine"
              className="rounded-full p-1.5 hover:bg-white/15"
            >
              <i className="bx bx-reset text-xl" />
            </button>
            <span className="mx-1 h-5 w-px bg-white/25" aria-hidden />
            <button onClick={fermer} aria-label="Fermer" className="rounded-full p-1.5 hover:bg-white/15">
              <i className="bx bx-x text-xl" />
            </button>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              setFacteur((f) => Math.min(MAX, Math.max(MIN, f + (e.deltaY < 0 ? PAS : -PAS))));
            }}
            onPointerDown={(e) => {
              if (facteur <= 1) return;
              setPrise({ x: e.clientX - pos.x, y: e.clientY - pos.y });
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!prise) return;
              setPos({ x: e.clientX - prise.x, y: e.clientY - prise.y });
            }}
            onPointerUp={() => setPrise(null)}
            className="flex max-h-[80vh] max-w-[92vw] items-center justify-center overflow-hidden"
            style={{ cursor: facteur > 1 ? (prise ? "grabbing" : "grab") : "default" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${facteur})`,
                transition: prise ? "none" : "transform 150ms ease-out",
              }}
              className="max-h-[80vh] max-w-[92vw] select-none object-contain"
            />
          </div>

          {legende && (
            <p
              onClick={(e) => e.stopPropagation()}
              className="mt-3 max-w-2xl text-center text-sm text-white/80"
            >
              {legende}
            </p>
          )}
        </div>
      )}
    </>
  );
}
