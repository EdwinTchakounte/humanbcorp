import type { Metadata } from "next";
import { getArticle, getArticles } from "@/lib/api";
import { ogBase } from "@/lib/og";
import ArticleView from "@/components/blog/ArticleView";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const articles = await getArticles("fr");
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticle(params.slug, "fr");
  if (!a) return {};
  const description = a.excerpt || undefined;
  return {
    title: a.title,
    description,
    alternates: { canonical: `/blog/${params.slug}` },
    // Bloc reconstruit en entier (cf. lib/og.ts) : `openGraph: undefined`
    // effaçait celui du layout racine, et un article sans couverture se
    // partageait alors sans le moindre aperçu.
    openGraph: {
      ...ogBase("fr"),
      type: "article",
      url: `/blog/${params.slug}`,
      title: a.title,
      description,
      ...(a.published_at ? { publishedTime: a.published_at } : {}),
      ...(a.cover?.url ? { images: [{ url: a.cover.url, alt: a.title }] } : {}),
    },
  };
}

export default function ArticlePage({ params }: Props) {
  return <ArticleView slug={params.slug} lang="fr" />;
}
