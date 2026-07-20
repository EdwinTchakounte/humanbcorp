import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormation } from "@/lib/api";
import type { Lang } from "@/lib/api";
import InscriptionWidget from "@/components/formations/InscriptionWidget";
import ShareLinks from "@/components/ShareLinks";
import JsonLd from "@/components/JsonLd";

const L = {
  fr: {
    back: "Toutes les formations",
    forme: "forme",
    partage: "Partager cette formation",
    partageMsg: "une formation proposée par HBC-RH",
  },
  en: {
    back: "All trainings",
    forme: "trains",
    partage: "Share this training",
    partageMsg: "a training offered by HBC-RH",
  },
} as const;

export default async function FormationDetail({ id, lang }: { id: string; lang: Lang }) {
  const t = L[lang];
  const base = lang === "en" ? "/en" : "";
  const formation = await getFormation(id);
  if (!formation) notFound();

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://humanbcorp.com";
  // Balisage schema.org : indispensable pour que Google comprenne qu'il s'agit
  // d'une formation, avec son prix et ses dates, plutôt que d'une page quelconque.
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: formation.title,
    description: (formation.description || "").slice(0, 500),
    url: `${site}${base}/formations/${formation.id}`,
    provider: {
      "@type": "Organization",
      name: "Human Brain Corporation-RH",
      url: site,
    },
    ...(formation.image_url ? { image: formation.image_url } : {}),
    offers: {
      "@type": "Offer",
      price: Number(formation.price) || 0,
      priceCurrency: "XAF",
      // Une session complète doit être annoncée comme telle : sinon Google
      // continue de l'afficher comme disponible.
      availability: formation.complete
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
      url: `${site}${base}/formations/${formation.id}`,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      // mode 1 = session à dates fixes, 2 = accès libre.
      courseMode: formation.mode === 2 ? "online" : "blended",
      ...(formation.date_debut ? { startDate: formation.date_debut } : {}),
      ...(formation.date_fin ? { endDate: formation.date_fin } : {}),
    },
  };

  return (
    <section className="py-14 md:py-20">
      <JsonLd data={jsonLd} />
      <div className="container-hbc">
        <Link
          href={`${base}/formations`}
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-brand"
        >
          <i className="bx bx-left-arrow-alt" /> {t.back}
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {formation.image_url && (
              <div className="mb-8 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formation.image_url} alt={formation.title} className="w-full object-cover" />
              </div>
            )}
            {/* École organisatrice si tierce, sinon la catégorie. */}
            {(formation.ecole || formation.categorie_name) && (
              <p className="eyebrow">
                {formation.ecole ? `${formation.ecole} ${t.forme}` : formation.categorie_name}
              </p>
            )}
            <h1 className="mt-3 text-3xl md:text-4xl">{formation.title}</h1>
            <div className="prose-hbc mt-6 whitespace-pre-line text-lg leading-relaxed text-muted">
              {formation.description}
            </div>

            <ShareLinks
              url={`${site}${base}/formations/${formation.id}`}
              message={`${formation.title} — ${t.partageMsg}`}
              lang={lang}
              titre={t.partage}
            />
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <InscriptionWidget formation={formation} lang={lang} />
          </aside>
        </div>
      </div>
    </section>
  );
}
