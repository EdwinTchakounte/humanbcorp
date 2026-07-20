"use client";

import { createContext, useContext, useState, useCallback } from "react";

/** Notifications transitoires — remplacent les `alert()` natifs (bloquants,
 *  hors charte) par un retour cohérent, non bloquant, empilé en bas à droite. */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

// Identifiant monotone (côté navigateur : Date.now/Math.random sont permis ici).
let counter = 0;

const META: Record<ToastKind, { icon: string; cls: string }> = {
  success: { icon: "bx-check-circle", cls: "border-green-200 bg-green-50 text-green-800" },
  error: { icon: "bx-error-circle", cls: "border-red-200 bg-red-50 text-red-800" },
  info: { icon: "bx-info-circle", cls: "border-line bg-white text-ink" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++counter;
      setItems((xs) => [...xs, { id, kind, message }]);
      // L'erreur reste un peu plus longtemps (on veut pouvoir la lire).
      window.setTimeout(() => remove(id), kind === "error" ? 6000 : 3500);
    },
    [remove],
  );

  const api: ToastApi = {
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => {
          const m = META[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-hbc-sm ${m.cls}`}
            >
              <i className={`bx ${m.icon} mt-0.5 text-lg`} />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                aria-label="Fermer"
                className="opacity-60 transition hover:opacity-100"
              >
                <i className="bx bx-x text-lg" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/** Accès aux notifications. Hors provider → no-op (jamais d'erreur runtime). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  return ctx ?? { success: () => {}, error: () => {}, info: () => {} };
}
