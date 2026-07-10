import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormation } from "@/lib/api";
import type { Lang } from "@/lib/api";
import InscriptionWidget from "@/components/formations/InscriptionWidget";

const L = {
  fr: { back: "Toutes les formations" },
  en: { back: "All trainings" },
} as const;

export default async function FormationDetail({ id, lang }: { id: string; lang: Lang }) {
  const t = L[lang];
  const base = lang === "en" ? "/en" : "";
  const formation = await getFormation(id);
  if (!formation) notFound();

  return (
    <section className="py-14 md:py-20">
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
            {formation.categorie_name && <p className="eyebrow">{formation.categorie_name}</p>}
            <h1 className="mt-3 text-3xl md:text-4xl">{formation.title}</h1>
            <div className="prose-hbc mt-6 whitespace-pre-line text-lg leading-relaxed text-muted">
              {formation.description}
            </div>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <InscriptionWidget formation={formation} lang={lang} />
          </aside>
        </div>
      </div>
    </section>
  );
}
