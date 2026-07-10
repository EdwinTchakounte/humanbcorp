"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Slide {
  url: string;
  alt: string;
}

/** Petite diapo d'images en fondu (utilisée dans « À propos »). */
export default function ImageSlideshow({
  slides,
  className = "",
  interval = 4500,
}: {
  slides: Slide[];
  className?: string;
  interval?: number;
}) {
  const [i, setI] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setI((p) => (p + 1) % count), interval);
    return () => clearInterval(id);
  }, [count, interval]);

  if (count === 0) return null;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence>
        <motion.div
          key={i}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slides[i].url} alt={slides[i].alt} className="h-full w-full object-cover" />
        </motion.div>
      </AnimatePresence>
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {slides.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Image ${k + 1}`}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
