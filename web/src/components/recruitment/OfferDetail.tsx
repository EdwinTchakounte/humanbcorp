import Link from "next/link";
import { notFound } from "next/navigation";
import { getOffer, type Lang } from "@/lib/api";
import CandidatureForm from "@/components/recruitment/CandidatureForm";
import JsonLd from "@/components/JsonLd";

const L = {
  fr: {
    back: "Toutes les offres",
    post: "Le poste",
    profile: "Profil recherché",
    closing: (d: string) => `Clôture le ${d}`,
    locale: "fr-FR",
  },
  en: {
    back: "All positions",
    post: "The role",
    profile: "Who we're looking for",
    closing: (d: string) => `Closes on ${d}`,
    locale: "en-GB",
  },
} as const;

export default async function OfferDetail({ slug, lang }: { slug: string; lang: Lang }) {
  const t = L[lang];
  const base = lang === "en" ? "/en" : "";
  const offer = await getOffer(slug);
  if (!offer) notFound();
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) : null;

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";
  // Balisage JobPosting : c'est lui — et lui seul — qui fait remonter l'offre
  // dans Google for Jobs, où se fait aujourd'hui l'essentiel de la recherche
  // d'emploi. Sans ce bloc, l'offre n'y apparaît tout simplement pas.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: offer.title,
    description: `${offer.description}\n\n${offer.profile}`,
    datePosted: offer.created_at,
    ...(offer.closing_date ? { validThrough: offer.closing_date } : {}),
    employmentType: offer.contract_type,
    hiringOrganization: {
      "@type": "Organization",
      name: "Human Brain Corporation-RH",
      sameAs: site,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: offer.location || "Douala",
        addressCountry: "CM",
      },
    },
    ...(offer.department ? { industry: offer.department } : {}),
  };

  return (
    <section className="py-14 md:py-20">
      <JsonLd data={jsonLd} />
      <div className="container-hbc">
        <Link
          href={`${base}/carrieres`}
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-brand"
        >
          <i className="bx bx-left-arrow-alt" /> {t.back}
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                {offer.contract_label}
              </span>
              {offer.department && <span className="text-sm text-muted">{offer.department}</span>}
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl">{offer.title}</h1>
            <p className="mt-2 text-sm text-muted">
              <i className="bx bx-map-pin" /> {offer.location}
              {fmtDate(offer.closing_date) && <> · {t.closing(fmtDate(offer.closing_date)!)}</>}
            </p>

            <div className="mt-8">
              <h2 className="text-xl">{t.post}</h2>
              <div className="prose-hbc mt-3 whitespace-pre-line leading-relaxed text-muted">{offer.description}</div>
            </div>

            {offer.profile && (
              <div className="mt-8">
                <h2 className="text-xl">{t.profile}</h2>
                <div className="prose-hbc mt-3 whitespace-pre-line leading-relaxed text-muted">{offer.profile}</div>
              </div>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <CandidatureForm offerSlug={offer.slug} offerTitle={offer.title} lang={lang} />
          </aside>
        </div>
      </div>
    </section>
  );
}
