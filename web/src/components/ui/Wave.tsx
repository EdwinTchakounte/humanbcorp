/** Séparateur en vague (SVG) placé en haut ou en bas d'une section. */
export default function Wave({
  className = "",
  fill = "#ffffff",
  position = "bottom",
}: {
  className?: string;
  fill?: string;
  position?: "bottom" | "top";
}) {
  const top = position === "top";
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-[1] leading-[0] ${top ? "top-0" : "bottom-0"} ${className}`}
      style={top ? { transform: "rotate(180deg)" } : undefined}
      aria-hidden
    >
      <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="block h-[60px] w-full md:h-[90px]">
        <path
          fill={fill}
          d="M0,64 C240,120 480,120 720,88 C960,56 1200,8 1440,40 L1440,120 L0,120 Z"
        />
      </svg>
    </div>
  );
}
