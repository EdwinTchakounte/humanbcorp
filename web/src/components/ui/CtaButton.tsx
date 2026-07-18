"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Cta } from "@/lib/types";

const STYLES: Record<string, string> = {
  accent: "btn-accent",
  brand: "btn-brand",
  "outline-brand": "btn-outline-brand",
  "outline-light": "btn-outline-light",
};

export default function CtaButton({ cta }: { cta: Cta }) {
  const pathname = usePathname();
  const enSite = pathname?.startsWith("/en");
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

  const raw = cta.href || "#";
  const external = raw.startsWith("http");
  // Lien interne du CMS (stocké en FR) : préfixer /en sur le site anglais.
  const href =
    !external && enSite && raw.startsWith("/") && !raw.startsWith("/en/") && raw !== "/en"
      ? `/en${raw}`
      : raw;
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
