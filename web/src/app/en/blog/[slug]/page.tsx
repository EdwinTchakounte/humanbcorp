import type { Metadata } from "next";
import { getArticle, getArticles } from "@/lib/api";
import ArticleView from "@/components/blog/ArticleView";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const articles = await getArticles("en");
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArticle(params.slug, "en");
  if (!a) return {};
  return {
    title: a.title,
    description: a.excerpt || undefined,
    alternates: { canonical: `/en/blog/${params.slug}` },
    openGraph: a.cover?.url ? { images: [a.cover.url] } : undefined,
  };
}

export default function ArticlePageEn({ params }: Props) {
  return <ArticleView slug={params.slug} lang="en" />;
}
