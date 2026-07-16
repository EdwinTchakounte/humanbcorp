import { ImageResponse } from "next/og";

import { getFormation, type Lang } from "@/lib/api";

/**
 * Vignette de partage d'une formation (WhatsApp, LinkedIn, Facebook).
 *
 * On ne partage plus l'image brute de la formation : son format est arbitraire
 * (le logo de repli était un carré 726×797 alors que ces plateformes attendent
 * du 1200×630), et elle ne dit ni de quelle formation il s'agit, ni quand elle
 * a lieu, ni s'il reste des places — précisément ce qui décide au moment où le
 * lien circule dans une conversation.
 *
 * La photo sert donc de fond, atténuée pour que le texte reste lisible quelle
 * qu'elle soit, et l'essentiel s'affiche par-dessus. Sans photo, le dégradé de
 * marque prend le relais.
 */
export const OG_SIZE = { width: 1200, height: 630 };

// Palette échantillonnée sur le logo (cf. tailwind.config.ts).
const BLEU = "#1C2F57";
const BLEU_CLAIR = "#3C5EA5";
const ORANGE = "#EC7123";

const L = {
  fr: {
    alt: "Formation — Human Brain Corporation-RH",
    defaut: "Formation",
    gratuit: "Gratuit",
    complet: "Session complète",
    places: (n: number) => `${n} place(s) restante(s)`,
    depuis: (d: string) => `À partir du ${d}`,
    entre: (d: string, f: string) => `Du ${d} au ${f}`,
    locale: "fr-FR",
  },
  en: {
    alt: "Training — Human Brain Corporation-RH",
    defaut: "Training",
    gratuit: "Free",
    complet: "Session full",
    places: (n: number) => `${n} seat(s) left`,
    depuis: (d: string) => `From ${d}`,
    entre: (d: string, f: string) => `${d} → ${f}`,
    locale: "en-GB",
  },
} as const;

/**
 * `Intl` en français sépare les milliers par une espace fine insécable (U+202F)
 * et glisse des espaces insécables dans les dates. La police de rendu ne
 * possède pas ces caractères : ils sortaient en carrés — « 3□000 FCFA ». On les
 * ramène à l'espace ordinaire, que toute police connaît.
 */
function sansEspacesFines(s: string): string {
  return s.replace(/[   ]/g, " ");
}

export async function formationOgCard(id: string, lang: Lang) {
  const t = L[lang];
  const f = await getFormation(id);

  const titre = f?.title ?? t.defaut;
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  let dates = "";
  if (f?.date_debut) {
    const d = new Date(f.date_debut).toLocaleDateString(t.locale, o);
    dates = sansEspacesFines(
      f.date_fin ? t.entre(d, new Date(f.date_fin).toLocaleDateString(t.locale, o)) : t.depuis(d)
    );
  }
  const prix =
    f && Number(f.price) > 0
      ? sansEspacesFines(`${new Intl.NumberFormat(t.locale).format(Number(f.price))} FCFA`)
      : t.gratuit;
  const places = f?.complete
    ? t.complet
    : f?.places_restantes != null
      ? t.places(f.places_restantes)
      : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          background: `linear-gradient(135deg, ${BLEU} 0%, ${BLEU_CLAIR} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        {f?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.image_url}
            alt=""
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            style={{
              position: "absolute",
              inset: 0,
              width: `${OG_SIZE.width}px`,
              height: `${OG_SIZE.height}px`,
              objectFit: "cover",
              opacity: 0.28,
            }}
          />
        ) : null}

        {/* Filet accent : la signature visuelle de la marque. */}
        <div style={{ display: "flex", height: "12px", background: ORANGE, width: "100%" }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "0 64px", gap: "18px" }}>
          {f?.categorie_name ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: ORANGE,
                fontWeight: 600,
              }}
            >
              {f.categorie_name}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              // Un titre long reste dans la carte plutôt que de déborder.
              fontSize: titre.length > 60 ? 54 : 68,
              lineHeight: 1.1,
              color: "#ffffff",
              fontWeight: 700,
              maxWidth: "1010px",
            }}
          >
            {titre.length > 110 ? `${titre.slice(0, 110)}…` : titre}
          </div>

          {dates ? <div style={{ display: "flex", fontSize: 30, color: "#dfe7f5" }}>{dates}</div> : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 64px 52px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                display: "flex",
                background: ORANGE,
                color: "#ffffff",
                fontSize: 30,
                fontWeight: 700,
                padding: "12px 28px",
                borderRadius: "999px",
              }}
            >
              {prix}
            </div>
            {places ? <div style={{ display: "flex", fontSize: 26, color: "#c9d6ee" }}>{places}</div> : null}
          </div>

          <div style={{ display: "flex", fontSize: 26, color: "#ffffff", fontWeight: 600 }}>
            Human Brain Corporation-RH
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}

export const OG_ALT = { fr: L.fr.alt, en: L.en.alt };
