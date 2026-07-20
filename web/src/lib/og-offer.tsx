import { ImageResponse } from "next/og";

import { getOffer, type Lang } from "@/lib/api";

/**
 * Flyer de partage d'une offre d'emploi (WhatsApp, Facebook, LinkedIn).
 *
 * C'est l'image qu'affichent ces plateformes quand le lien de l'offre circule.
 * Elle doit donc porter seule l'essentiel : qui recrute, pour quel poste, à
 * quelles conditions — sans quoi le lien ne dit rien dans une conversation.
 *
 * La composition **s'adapte au contenu** : chaque information (lieu, contrat,
 * rémunération, département) n'apparaît que si le recruteur l'a activée ET
 * renseignée. Un champ retiré ne laisse pas de trou, la maquette se resserre.
 *
 * L'accroche suit la même règle : « UCB recrute » si l'entreprise est révélée
 * (offre premium), « Une entreprise recrute » sinon. Cet anonymat est décidé
 * côté serveur — le flyer ne fait que refléter ce que l'API expose.
 */
export const OG_SIZE = { width: 1200, height: 630 };

// Palette échantillonnée sur le logo (cf. tailwind.config.ts).
const BLEU = "#1C2F57";
const BLEU_CLAIR = "#3C5EA5";
const ORANGE = "#EC7123";
const CLAIR = "#dfe7f5";

const L = {
  fr: {
    alt: "Offre d'emploi — Human Brain Corporation-RH",
    defaut: "Offre d'emploi",
    postuler: "Candidatez dès maintenant",
    jusquau: (d: string) => `Jusqu'au ${d}`,
    une: "Une entreprise recrute",
    aLaUne: "À LA UNE",
    locale: "fr-FR",
  },
  en: {
    alt: "Job opening — Human Brain Corporation-RH",
    defaut: "Job opening",
    postuler: "Apply now",
    jusquau: (d: string) => `Until ${d}`,
    une: "A company is hiring",
    aLaUne: "FEATURED",
    locale: "en-GB",
  },
} as const;

/**
 * `Intl` glisse des espaces fines insécables que la police de rendu ne possède
 * pas : elles sortiraient en carrés. On les ramène à l'espace ordinaire.
 */
function sansEspacesFines(s: string): string {
  return s.replace(/[   ]/g, " ");
}

export async function offerOgCard(slug: string, lang: Lang) {
  const t = L[lang];
  const o = await getOffer(slug);

  const titre = o?.title ?? t.defaut;
  // L'accroche vient du serveur ; en anglais on retraduit le cas anonyme.
  const accroche = o
    ? o.company?.name
      ? `${o.company.name} ${lang === "en" ? "is hiring" : "recrute"}`
      : t.une
    : t.une;

  // Chaque info n'entre dans la bande que si elle est réellement disponible.
  const infos = [o?.contract_label, o?.location, o?.salary, o?.department].filter(
    (v): v is string => Boolean(v && v.trim())
  );

  const echeance = o?.closing_date
    ? sansEspacesFines(
        t.jusquau(
          new Date(o.closing_date).toLocaleDateString(t.locale, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        )
      )
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
          background: `linear-gradient(135deg, ${BLEU} 0%, ${BLEU_CLAIR} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Filet d'accent : la signature visuelle de la marque. */}
        <div style={{ display: "flex", height: "12px", background: ORANGE, width: "100%" }} />

        <div style={{ display: "flex", flexDirection: "column", padding: "0 64px", gap: "20px" }}>
          {/* Accroche + logo éventuel de l'entreprise */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", width: "5px", height: "34px", background: ORANGE }} />
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: ORANGE,
                  fontWeight: 700,
                }}
              >
                {accroche}
              </div>
            </div>
            {o?.company?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.company.logo}
                alt=""
                width={110}
                height={70}
                style={{ objectFit: "contain", width: "110px", height: "70px" }}
              />
            ) : null}
          </div>

          {/* Intitulé du poste */}
          <div
            style={{
              display: "flex",
              // Un intitulé long reste dans le cadre plutôt que de déborder.
              fontSize: titre.length > 55 ? 56 : 70,
              lineHeight: 1.08,
              color: "#ffffff",
              fontWeight: 700,
              maxWidth: "1010px",
            }}
          >
            {titre.length > 100 ? `${titre.slice(0, 100)}…` : titre}
          </div>

          {/* Bande d'informations — uniquement celles qui sont disponibles */}
          {infos.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {infos.map((info) => (
                <div
                  key={info}
                  style={{
                    display: "flex",
                    background: "rgba(255,255,255,0.14)",
                    color: "#ffffff",
                    fontSize: 26,
                    fontWeight: 600,
                    padding: "10px 22px",
                    borderRadius: "6px",
                  }}
                >
                  {info}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Pied : appel à l'action, échéance, marque */}
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
                fontSize: 28,
                fontWeight: 700,
                padding: "12px 28px",
                borderRadius: "6px",
              }}
            >
              {t.postuler}
            </div>
            {echeance ? (
              <div style={{ display: "flex", fontSize: 25, color: CLAIR }}>{echeance}</div>
            ) : null}
            {o?.is_featured ? (
              <div
                style={{
                  display: "flex",
                  border: `2px solid ${ORANGE}`,
                  color: ORANGE,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  padding: "6px 14px",
                  borderRadius: "4px",
                }}
              >
                {t.aLaUne}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", fontSize: 25, color: "#ffffff", fontWeight: 600 }}>
            Human Brain Corporation-RH
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}

export const OG_ALT = { fr: L.fr.alt, en: L.en.alt };
