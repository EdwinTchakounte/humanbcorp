/** Formes organiques (blobs) décoratives, en fond de section. */
export default function Blobs({ variant = "brand" }: { variant?: "brand" | "accent" | "mix" }) {
  const a = variant === "accent" ? "#EC7123" : "#3C5EA5";
  const b = variant === "mix" ? "#EC7123" : variant === "accent" ? "#C8601D" : "#2D467B";
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <svg
        className="animate-float-slow absolute -left-24 -top-24 h-[420px] w-[420px] opacity-[0.08]"
        viewBox="0 0 200 200"
      >
        <path
          fill={a}
          d="M45,-59C57,-49,64,-33,68,-16C71,1,71,20,63,35C55,50,39,62,20,68C1,74,-20,74,-38,66C-56,58,-70,42,-74,24C-78,6,-72,-14,-61,-29C-50,-44,-34,-54,-17,-60C1,-66,20,-69,45,-59Z"
          transform="translate(100 100)"
        />
      </svg>
      <svg
        className="animate-float-slow absolute -bottom-28 -right-20 h-[380px] w-[380px] opacity-[0.07] [animation-delay:2s]"
        viewBox="0 0 200 200"
      >
        <path
          fill={b}
          d="M52,-64C65,-53,71,-33,73,-14C75,6,71,26,60,42C48,58,29,70,7,73C-15,76,-40,70,-56,55C-72,40,-79,17,-76,-4C-73,-25,-60,-45,-44,-57C-27,-68,-7,-71,11,-73C29,-75,58,-75,52,-64Z"
          transform="translate(100 100)"
        />
      </svg>
    </div>
  );
}
