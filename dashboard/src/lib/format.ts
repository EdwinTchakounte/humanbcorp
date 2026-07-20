/** Formatage partagé (monnaie, dates) — une seule source pour tout le dashboard.
 *
 * Avant, chaque écran redéfinissait ces fonctions, avec des comportements
 * divergents (0 → « Gratuit » ici, « — » là ; dates parfois non formatées).
 */

/** Montant en FCFA (séparateurs fr-FR). `zero` = rendu quand le montant vaut 0. */
export function formatMoney(v: string | number | null | undefined, zero = "—"): string {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  if (!n || Number.isNaN(n)) return zero;
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

/** Date « moyenne » (12 mars 2026). Vide → « — ». */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

/** Date + heure (12 mars 2026, 14:30). Vide → « — ». */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}
