import Link from "next/link";
import { notFound } from "next/navigation";
import { getOffer, type Lang } from "@/lib/api";
import CandidatureForm from "@/components/recruitment/CandidatureForm";
import ShareLinks from "@/components/ShareLinks";
import JsonLd from "@/components/JsonLd";
import { accrocheOffre } from "@/lib/offer-meta";

const L = {
  fr: {
    back: "Toutes les offres",
    post: "Le poste",
    profile: "Profil recherché",
    closing: (d: string) => `Clôture le ${d}`,
    locale: "fr-FR",
    directTitre: "Postuler auprès de l'entreprise",
    directTexte:
      "Cette offre se traite directement avec l'entreprise : votre candidature lui parvient sans passer par nos services.",
    directCta: "Postuler maintenant",
    siteEntreprise: "Site de l'entreprise",
    aLaUne: "À la une",
  },
  en: {
    back: "All positions",
    post: "The role",
    profile: "Who we're looking for",
    closing: (d: string) => `Closes on ${d}`,
    locale: "en-GB",
    directTitre: "Apply to the company",
    directTexte:
      "This position is handled directly by the company: your application reaches them without going through us.",
    directCta: "Apply now",
    siteEntreprise: "Company website",
    aLaUne: "Featured",
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
  // Accroche : « UCB recrute » si l'entreprise est révélée, sinon anonyme.
  const accroche = accrocheOffre(offer.company, lang);
  // Puces d'information : uniquement ce qui est activé ET renseigné.
  const chips = [offer.contract_label, offer.location, offer.salary, offer.department].filter(
    (v): v is string => Boolean(v && v.trim())
  );
  // URL absolue : indispensable pour que WhatsApp/Facebook résolvent l'aperçu.
  const partageUrl = `${site}${base}/carrieres/${offer.slug}`;
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
    ...(offer.contract_label ? { employmentType: offer.contract_label } : {}),
    // L'employeur déclaré est l'entreprise quand elle est révélée (offre
    // premium) ; sinon HBC-RH, qui porte le recrutement pour un client anonyme.
    hiringOrganization: offer.company
      ? {
          "@type": "Organization",
          name: offer.company.name,
          ...(offer.company.website ? { sameAs: offer.company.website } : {}),
          ...(offer.company.logo ? { logo: offer.company.logo } : {}),
        }
      : {
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
            {/* Accroche contextuelle + logo si l'entreprise est révélée. */}
            <div className="flex items-center gap-4">
              {offer.company?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offer.company.logo}
                  alt={offer.company.name}
                  className="h-12 w-12 shrink-0 rounded-md border border-line bg-white object-contain p-1"
                />
              )}
              <p className="eyebrow">{accroche}</p>
              {offer.is_featured && (
                <span className="rounded-sm bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                  {t.aLaUne}
                </span>
              )}
            </div>

            <h1 className="mt-3 text-3xl md:text-4xl">{offer.title}</h1>

            {/* Bande d'informations : seules celles qui sont activées ET
                renseignées apparaissent — la ligne se resserre d'elle-même. */}
            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-sm bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            {fmtDate(offer.closing_date) && (
              <p className="mt-3 text-sm text-muted">
                <i className="bx bx-calendar" /> {t.closing(fmtDate(offer.closing_date)!)}
              </p>
            )}

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

            <ShareLinks url={partageUrl} message={`${accroche} : ${offer.title}`} lang={lang} titre={lang === "en" ? "Share this opening" : "Partager cette offre"} />
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            {offer.apply.mode === "direct" && offer.apply.target ? (
              // Candidature directe (offre premium) : on n'affiche pas le
              // formulaire, la candidature ne doit pas transiter par nous.
              <div className="card-soft p-6">
                <h2 className="text-lg">{t.directTitre}</h2>
                <p className="mt-2 text-sm text-muted">{t.directTexte}</p>
                <a
                  href={offer.apply.target}
                  target={offer.apply.target.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  className="btn-accent mt-5 w-full"
                >
                  <i className="bx bx-paper-plane" /> {t.directCta}
                </a>
                {offer.company?.website && (
                  <a
                    href={offer.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                  >
                    <i className="bx bx-link-external" /> {t.siteEntreprise}
                  </a>
                )}
              </div>
            ) : (
              <CandidatureForm offerSlug={offer.slug} offerTitle={offer.title} lang={lang} />
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
