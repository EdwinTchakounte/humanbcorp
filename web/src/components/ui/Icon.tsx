/** Icône Boxicon (feuille de style chargée dans le layout). name ex: "bx-globe", "bxs-map". */
export default function Icon({ name, className = "" }: { name: string; className?: string }) {
  if (!name) return null;
  return <i className={`bx ${name} ${className}`} aria-hidden />;
}
