import type { Metadata } from "next";
import { buildMetadata } from "@/lib/meta";
import BlogList from "@/components/blog/BlogList";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("blog", "en", "/en/blog");
}

export default function BlogPageEn() {
  return <BlogList lang="en" />;
}
