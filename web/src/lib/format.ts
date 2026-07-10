import type { Lang } from "./api";

const MONTHS: Record<Lang, string[]> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** Formate une date ISO (YYYY-MM-DD) en texte lisible, sans dépendre du fuseau. */
export function formatDate(iso: string | null, lang: Lang = "fr"): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const month = MONTHS[lang][m - 1];
  return lang === "en" ? `${month} ${d}, ${y}` : `${d} ${month} ${y}`;
}
