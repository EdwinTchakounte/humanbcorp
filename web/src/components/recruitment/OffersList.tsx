import Link from "next/link";
import { getOffers, type Lang } from "@/lib/api";
import CandidatureForm from "@/components/recruitment/CandidatureForm";

const L = {
  fr: {
    eyebrow: "Carrières",
    title: "Rejoignez l’équipe HBC-RH",
    lead: "Découvrez nos opportunités et postulez en quelques clics. Pas d’offre correspondante ? Envoyez-nous une candidature spontanée.",
    empty: "Aucune offre ouverte pour le moment.",
    see: "Voir l’offre",
    closing: (d: string) => `Clôture le ${d}`,
    spontaneous: "Candidature spontanée",
    locale: "fr-FR",
  },
  en: {
    eyebrow: "Careers",
    title: "Join the HBC-RH team",
    lead: "Explore our opportunities and apply in a few clicks. No matching opening? Send us an open application.",
    empty: "No open position at the moment.",
    see: "View position",
    closing: (d: string) => `Closes on ${d}`,
    spontaneous: "Open application",
    locale: "en-GB",
  },
} as const;

export default async function OffersList({ lang }: { lang: Lang }) {
  const t = L[lang];
  const base = lang === "en" ? "/en" : "";
  const offers = await getOffers();
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <section className="py-14 md:py-20">
      <div className="container-hbc">
        <header className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-3 text-3xl md:text-4xl">{t.title}</h1>
          <p className="mt-4 text-lg text-muted">{t.lead}</p>
        </header>

        {offers.length === 0 ? (
          <p className="mt-12 text-center text-muted">{t.empty}</p>
        ) : (
          <div className="mx-auto mt-12 grid max-w-4xl gap-4">
            {offers.map((o) => (
              <Link
                key={o.id}
                href={`${base}/carrieres/${o.slug}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-line/70 bg-white p-5 shadow-hbc-sm transition hover:-translate-y-0.5 hover:shadow-hbc md:p-6"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                      {o.contract_label}
                    </span>
                    {o.department && <span className="text-xs text-muted">{o.department}</span>}
                  </div>
                  <h3 className="mt-2 text-lg leading-snug">{o.title}</h3>
                  <p className="mt-1 text-sm text-muted">
                    <i className="bx bx-map-pin" /> {o.location}
                    {fmtDate(o.closing_date) && <> · {t.closing(fmtDate(o.closing_date)!)}</>}
                  </p>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-accent sm:inline-flex">
                  {t.see} <i className="bx bx-right-arrow-alt transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="mx-auto mt-16 max-w-2xl">
          <h2 className="mb-6 text-center text-2xl">{t.spontaneous}</h2>
          <CandidatureForm lang={lang} />
        </div>
      </div>
    </section>
  );
}
