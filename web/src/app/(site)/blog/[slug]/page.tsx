import type { Metadata } from "next";
import { getArticle, getArticles } from "@/lib/api";
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
  return {
    title: a.title,
    description: a.excerpt || undefined,
    alternates: { canonical: `/blog/${params.slug}` },
    openGraph: a.cover?.url ? { images: [a.cover.url] } : undefined,
  };
}

export default function ArticlePage({ params }: Props) {
  return <ArticleView slug={params.slug} lang="fr" />;
}
