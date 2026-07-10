"use client";

import Link from "next/link";
import type { Cta } from "@/lib/types";

const STYLES: Record<string, string> = {
  accent: "btn-accent",
  brand: "btn-brand",
  "outline-brand": "btn-outline-brand",
  "outline-light": "btn-outline-light",
};

export default function CtaButton({ cta }: { cta: Cta }) {
  const cls = STYLES[cta.style || "brand"] || "btn-brand";

  // Action « contact » → défilement vers la section contact.
  if (cta.action === "contact") {
    return (
      <button
        type="button"
        className={cls}
        onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
      >
        {cta.label}
      </button>
    );
  }

  const href = cta.href || "#";
  const external = href.startsWith("http");
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {cta.label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {cta.label}
    </Link>
  );
}
