import Link from "next/link";
import { getArticles, getPage, type Lang } from "@/lib/api";
import SectionRenderer from "@/components/SectionRenderer";
import Reveal from "@/components/ui/Reveal";
import Pattern from "@/components/ui/Pattern";
import { formatDate } from "@/lib/format";

/** Page blog : hero (CMS) + grille d'articles (modèle Article) + CTA (CMS). */
export default async function BlogList({ lang }: { lang: Lang }) {
  const [page, articles] = await Promise.all([getPage("blog", lang), getArticles(lang)]);
  const prefix = lang === "en" ? "/en" : "";
  const hero = page?.sections.find((s) => s.type === "hero");
  const cta = page?.sections.find((s) => s.type === "cta");

  return (
    <>
      {hero && <SectionRenderer section={hero} />}

      <section className="relative overflow-hidden bg-white py-24 md:py-28">
        <Pattern variant="dots" opacity={0.06} />
        <div className="container-hbc">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="eyebrow">{lang === "en" ? "The blog" : "Le blog"}</p>
            <h2 className="mt-3 text-3xl md:text-4xl">{lang === "en" ? "Latest articles" : "Nos derniers articles"}</h2>
            <div className="section-rule" />
          </div>

          {articles.length === 0 ? (
            <p className="text-center text-muted">{lang === "en" ? "No article yet." : "Aucun article pour le moment."}</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((a, i) => (
                <Reveal key={a.id} delay={0.06 * (i % 3)}>
                  <Link
                    href={`${prefix}/blog/${a.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-hbc-sm transition-all duration-300 ease-hbc hover:-translate-y-1.5 hover:shadow-hbc"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {a.cover?.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.cover.url}
                          alt={a.cover.alt || a.title}
                          className="h-full w-full object-cover transition-transform duration-500 ease-hbc group-hover:scale-105"
                        />
                      )}
                      {a.category && (
                        <span className="absolute left-3 top-3 rounded-sm bg-accent px-2.5 py-1 text-xs font-semibold text-white shadow">
                          {a.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <div className="mb-2 text-xs text-muted">
                        {formatDate(a.published_at, lang)} · {a.author}
                      </div>
                      <h3 className="text-lg text-brand-deep">{a.title}</h3>
                      {a.excerpt && <p className="mt-2 flex-1 text-sm text-muted">{a.excerpt}</p>}
                      <span className="mt-4 inline-flex items-center gap-1 font-heading text-sm font-semibold text-accent">
                        {lang === "en" ? "Read more" : "Lire l'article"} <i className="bx bx-right-arrow-alt" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {cta && <SectionRenderer section={cta} />}
    </>
  );
}
