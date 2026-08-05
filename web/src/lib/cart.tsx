"use client";

/**
 * Panier de **session anonyme**, côté navigateur.
 *
 * La vitrine laisse un visiteur non identifié empiler des formations pour
 * plusieurs personnes (un parent pour ses enfants) SANS créer de compte : le
 * panier vit dans le `localStorage` de l'appareil. Il n'est matérialisé côté
 * serveur qu'au checkout (`POST /site/panier/checkout/`), une fois l'acheteur
 * identifié par son e-mail.
 *
 * Les adresses déjà saisies sont mémorisées localement (même appareil) pour
 * l'autocomplétion : on ne les envoie jamais interroger le serveur par e-mail,
 * ce qui exposerait l'adresse de quiconque taperait cette adresse.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const CART_KEY = "hbc_cart_v1";
const ADDR_KEY = "hbc_addresses_v1";

/** Une ligne = une formation pour une personne (l'acheteur ou un enfant). */
export interface CartLine {
  id: string;
  formationId: number;
  title: string;
  /** Prix figé à l'ajout (chaîne FCFA, ex. "1500.00"). */
  price: string;
  /** L'acheteur s'inscrit lui-même (le participant sera résolu au checkout). */
  forMe: boolean;
  first_name: string;
  last_name: string;
  email: string;
}

export interface SavedAddress {
  nom_complet?: string;
  telephone?: string;
  ligne1?: string;
  ligne2?: string;
  ville?: string;
  region?: string;
  pays?: string;
}

interface CartCtx {
  lines: CartLine[];
  count: number;
  total: number;
  isOpen: boolean;
  addLine: (line: Omit<CartLine, "id">) => void;
  removeLine: (id: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

function uid(): string {
  // Pas de dépendance : suffisant pour distinguer des lignes de panier.
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation depuis le localStorage (après montage, pour ne pas casser le SSR).
  useEffect(() => {
    setLines(readLines());
    setHydrated(true);
  }, []);

  // Persistance à chaque changement, une fois hydraté.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* quota / mode privé : le panier reste en mémoire pour la session */
    }
  }, [lines, hydrated]);

  const addLine = useCallback((line: Omit<CartLine, "id">) => {
    setLines((prev) => {
      // Dédoublonnage : même formation + même personne = une seule ligne.
      const key = (l: Omit<CartLine, "id">) =>
        `${l.formationId}|${l.forMe ? "__me__" : l.email.trim().toLowerCase()}|${l.first_name
          .trim()
          .toLowerCase()}|${l.last_name.trim().toLowerCase()}`;
      if (prev.some((p) => key(p) === key(line))) return prev;
      return [...prev, { ...line, id: uid() }];
    });
    setOpen(true);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.price) || 0), 0),
    [lines]
  );

  const value: CartCtx = {
    lines,
    count: lines.length,
    total,
    isOpen,
    addLine,
    removeLine,
    clear,
    openDrawer,
    closeDrawer,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Adresses mémorisées localement (autocomplétion, jamais côté serveur par e-mail)
// ---------------------------------------------------------------------------
export function getSavedAddresses(): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ADDR_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveAddress(addr: SavedAddress) {
  if (typeof window === "undefined") return;
  const norm = (a: SavedAddress) =>
    `${(a.ligne1 || "").trim().toLowerCase()}|${(a.ville || "").trim().toLowerCase()}`;
  if (!(addr.ligne1 || "").trim()) return; // rien d'utile à retenir
  try {
    const list = getSavedAddresses().filter((a) => norm(a) !== norm(addr));
    list.unshift(addr);
    window.localStorage.setItem(ADDR_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* best-effort */
  }
}
