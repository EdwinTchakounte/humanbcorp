import type { Metadata } from "next";
import { buildMetadata } from "@/lib/meta";
import BlogList from "@/components/blog/BlogList";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("blog", "fr", "/blog");
}

export default function BlogPage() {
  return <BlogList lang="fr" />;
}
