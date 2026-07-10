import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticle, getArticles, type Lang } from "@/lib/api";
import Reveal from "@/components/ui/Reveal";
import Pattern from "@/components/ui/Pattern";
import { formatDate } from "@/lib/format";

/** Page d'un article de blog. */
export default async function ArticleView({ slug, lang }: { slug: string; lang: Lang }) {
  const article = await getArticle(slug, lang);
  if (!article) notFound();
  const prefix = lang === "en" ? "/en" : "";
  const related = (await getArticles(lang)).filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <article>
      {/* En-tête avec la couverture */}
      <header className="relative h-[42vh] max-h-[420px] min-h-[300px] w-full overflow-hidden bg-brand-deep">
        {article.cover?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover.url} alt={article.cover.alt || article.title} className="h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(20,33,64,.45), rgba(20,33,64,.72))" }}
        />
        <div className="absolute inset-0 flex items-end">
          <div className="container-hbc pb-10">
            {article.category && (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">{article.category}</span>
            )}
            <h1 className="mt-4 max-w-3xl text-3xl text-white md:text-5xl">{article.title}</h1>
            <p className="mt-3 text-sm text-white/80">
              {formatDate(article.published_at, lang)} · {article.author}
            </p>
          </div>
        </div>
      </header>

      {/* Corps */}
      <section className="relative overflow-hidden bg-white py-16 md:py-20">
        <Pattern variant="grid" opacity={0.05} />
        <div className="container-hbc">
          <Reveal>
            <div className="mx-auto max-w-3xl">
              <Link href={`${prefix}/blog`} className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-accent">
                <i className="bx bx-left-arrow-alt" /> {lang === "en" ? "All articles" : "Tous les articles"}
              </Link>
              <div className="space-y-5 whitespace-pre-line text-lg leading-relaxed text-ink/90">
                {article.body}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Articles liés */}
      {related.length > 0 && (
        <section className="relative overflow-hidden bg-brand-soft py-20">
          <Pattern variant="dots" opacity={0.07} />
          <div className="container-hbc">
            <h2 className="mb-10 text-center text-2xl md:text-3xl">
              {lang === "en" ? "Keep reading" : "À lire aussi"}
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {related.map((a) => (
                <Link
                  key={a.id}
                  href={`${prefix}/blog/${a.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-line/70 bg-white shadow-hbc-sm transition-all hover:-translate-y-1.5 hover:shadow-hbc"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    {a.cover?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.cover.url} alt={a.cover.alt || a.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="mb-1 text-xs text-muted">{formatDate(a.published_at, lang)}</div>
                    <h3 className="text-base text-brand-deep">{a.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
