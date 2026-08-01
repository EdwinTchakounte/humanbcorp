"use client";

import { useCart } from "@/lib/cart";

/** Icône panier + badge du nombre de lignes. Ouvre le tiroir. */
export default function CartButton({ label = "Panier" }: { label?: string }) {
  const { count, openDrawer } = useCart();
  return (
    <button
      onClick={openDrawer}
      aria-label={label}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-brand-deep transition-colors hover:bg-brand-soft hover:text-accent"
    >
      <i className="bx bx-cart text-2xl" aria-hidden />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-white">
          {count}
        </span>
      )}
    </button>
  );
}
