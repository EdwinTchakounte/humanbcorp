import Link from "next/link";
import { getFormations } from "@/lib/api";
import type { Lang } from "@/lib/api";

const L = {
  fr: {
    eyebrow: "Nos formations",
    title: "Développez vos compétences RH",
    lead: "Choisissez une formation, inscrivez-vous en quelques clics et réglez en ligne par Mobile Money.",
    empty: "Aucune formation disponible pour le moment.",
    free: "Gratuit",
    cta: "S’inscrire",
  },
  en: {
    eyebrow: "Our trainings",
    title: "Grow your HR skills",
    lead: "Pick a training, register in a few clicks and pay online via Mobile Money.",
    empty: "No training available at the moment.",
    free: "Free",
    cta: "Register",
  },
} as const;

function fmtPrice(v: string, freeLabel: string) {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!n) return freeLabel;
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

export default async function FormationsList({ lang }: { lang: Lang }) {
  const t = L[lang];
  const base = lang === "en" ? "/en" : "";
  const formations = await getFormations();

  return (
    <section className="bg-brand-soft py-14 md:py-20">
      <div className="container-hbc">
        <header className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1 className="mt-3 text-3xl md:text-4xl">{t.title}</h1>
          <p className="mt-4 text-lg text-muted">{t.lead}</p>
        </header>

        {formations.length === 0 ? (
          <p className="mt-12 text-center text-muted">{t.empty}</p>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {formations.map((f) => (
              <Link
                key={f.id}
                href={`${base}/formations/${f.id}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-hbc-sm transition hover:-translate-y-1 hover:shadow-hbc"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-brand-soft">
                  {f.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.image_url}
                      alt={f.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl text-brand/30">
                      <i className="bx bxs-graduation" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {f.categorie_name && <p className="eyebrow">{f.categorie_name}</p>}
                  <h3 className="mt-2 text-lg leading-snug">{f.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{f.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-bold text-brand">{fmtPrice(f.price, t.free)}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
                      {t.cta} <i className="bx bx-right-arrow-alt transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
