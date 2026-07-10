/** Motif de fond décoratif : carreaux (grid) ou points, avec fondu radial doux. */
export default function Pattern({
  variant = "grid",
  className = "",
  color = "#3C5EA5",
  opacity = 0.09,
  fade = "center",
}: {
  variant?: "grid" | "dots";
  className?: string;
  color?: string;
  opacity?: number;
  /** Zone où le motif reste visible avant de s'estomper. */
  fade?: "center" | "top" | "bottom" | "none";
}) {
  const id = `pat-${variant}-${Math.round(opacity * 100)}-${fade}`;
  const mask =
    fade === "none"
      ? undefined
      : fade === "top"
      ? "linear-gradient(to bottom, black, transparent 85%)"
      : fade === "bottom"
      ? "linear-gradient(to top, black, transparent 85%)"
      : "radial-gradient(ellipse 80% 70% at 50% 45%, black 30%, transparent 78%)";

  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
      style={mask ? { WebkitMaskImage: mask, maskImage: mask } : undefined}
      aria-hidden
    >
      <svg className="h-full w-full" style={{ opacity }}>
        <defs>
          {variant === "grid" ? (
            <pattern id={id} width="38" height="38" patternUnits="userSpaceOnUse">
              <path d="M38 0H0V38" fill="none" stroke={color} strokeWidth="1.1" />
            </pattern>
          ) : (
            <pattern id={id} width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="2" fill={color} />
            </pattern>
          )}
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
