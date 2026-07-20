"use client";

import { useEffect, useId, useRef } from "react";

/* ------------------------------------------------------------------ *
 * États partagés : chargement / vide / erreur / statut.
 * Avant, chaque écran réinventait ces états (ou n'en montrait aucun),
 * d'où des ressentis incohérents. Centralisés ici pour un rendu uniforme.
 * ------------------------------------------------------------------ */

/** Petit indicateur d'attente en ligne (bouton, cellule…). */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <i
      className={`bx bx-loader-alt animate-spin ${className}`}
      role="status"
      aria-label="Chargement"
    />
  );
}

/** Bloc de chargement centré — remplace les écrans blancs pendant le fetch. */
export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <Spinner className="text-xl text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Rangées « squelette » pour un tableau en cours de chargement. */
export function SkeletonRows({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-2 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="skeleton h-4"
              style={{ width: c === 0 ? "28%" : `${Math.max(10, 22 - c * 3)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** État vide explicite — dit ce qui manque et propose l'action utile. */
export function EmptyState({
  icon = "bx-inbox",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <i className={`bx ${icon} text-4xl text-muted/60`} />
      <p className="font-heading font-semibold text-brand-deep">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** État d'erreur avec possibilité de réessayer. */
export function ErrorState({
  message = "Une erreur est survenue.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <i className="bx bx-error-circle text-4xl text-red-400" />
      <p className="max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost">
          <i className="bx bx-refresh" /> Réessayer
        </button>
      )}
    </div>
  );
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

/** Pastille de statut à tons sémantiques (voir .badge-* dans globals.css). */
export function Badge({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <span className={`badge-${tone}`}>
      {icon && <i className={`bx ${icon}`} />}
      {children}
    </span>
  );
}

/** En-tête d'écran cohérent : titre, sous-titre optionnel, actions à droite. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-brand-deep">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Interrupteur Visible / masqué. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || (checked ? "Visible" : "Masqué")}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
      title={checked ? "Visible" : "Masqué"}
    >
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-brand" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
      {label && <span className="text-xs text-muted">{label}</span>}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // Le label doit être rattaché à son champ : sinon cliquer le libellé ne place
  // pas le curseur, et un lecteur d'écran annonce un champ sans nom.
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <textarea id={id} className="input" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Champ <select> stylé. */
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Pagination simple (précédent / pages / suivant).
 *  15 plutôt que 5 : à 5 par page, retrouver une ressource obligeait à cliquer
 *  « suivant » plusieurs fois avant même de commencer à naviguer. */
export const PAGE_SIZE = 15;

export function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pageCount <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">
        {from}–{to} sur {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className="btn-ghost disabled:opacity-40"
        >
          <i className="bx bx-chevron-left" />
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={`h-8 w-8 rounded-lg text-sm font-medium transition ${
              p === page ? "bg-brand text-white" : "text-ink hover:bg-brand-soft"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          aria-label="Page suivante"
          className="btn-ghost disabled:opacity-40"
        >
          <i className="bx bx-chevron-right" />
        </button>
      </div>
    </div>
  );
}

/** Fenêtre modale simple. */
export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Échap pour fermer + focus initial sur le panneau : sans ça, le clavier
  // restait « piégé » derrière la modale et Échap ne faisait rien.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-xl outline-none">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h3 id={titleId} className="font-heading text-lg font-semibold text-brand-deep">{title}</h3>
          <button onClick={onClose} aria-label="Fermer" className="text-muted hover:text-ink">
            <i className="bx bx-x text-2xl" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
