/** Icônes RH en filigrane, flottant doucement en fond de section. */
const ICONS = [
  { name: "bx-group", top: "12%", left: "6%", size: "3.2rem", delay: "0s" },
  { name: "bx-briefcase-alt-2", top: "68%", left: "10%", size: "2.6rem", delay: "1.2s" },
  { name: "bx-target-lock", top: "22%", left: "86%", size: "3rem", delay: "0.6s" },
  { name: "bx-book-reader", top: "74%", left: "82%", size: "3.4rem", delay: "1.8s" },
  { name: "bx-bulb", top: "44%", left: "48%", size: "2.4rem", delay: "0.9s" },
  { name: "bx-globe", top: "84%", left: "44%", size: "2.8rem", delay: "2.2s" },
];

export default function FloatingIcons({ color = "#3C5EA5", opacity = 0.06 }: { color?: string; opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {ICONS.map((ic, i) => (
        <i
          key={i}
          className={`bx ${ic.name} animate-float-slow absolute`}
          style={{
            top: ic.top,
            left: ic.left,
            fontSize: ic.size,
            color,
            opacity,
            animationDelay: ic.delay,
          }}
        />
      ))}
    </div>
  );
}
