"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tokens, login as apiLogin, me as apiMe } from "./api";
import type { Profile } from "./types";

interface AuthCtx {
  authed: boolean;
  ready: boolean;
  profile: Profile | null;
  isAdmin: boolean;
  canWrite: (moduleKey: string) => boolean;
  signIn: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  authed: false,
  ready: false,
  profile: null,
  isAdmin: false,
  canWrite: () => false,
  signIn: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const hasToken = Boolean(tokens.access);
    setAuthed(hasToken);
    if (hasToken) {
      // Rechargement de page : on récupère le profil depuis le token stocké.
      apiMe().then((p) => {
        setProfile(p);
        setReady(true);
      });
    } else {
      setReady(true);
    }
    const onStorage = () => setAuthed(Boolean(tokens.access));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const signIn = async (username: string, password: string) => {
    const p = await apiLogin(username, password);
    if (p) {
      setProfile(p);
      setAuthed(true); // MAJ immédiate de l'état dans l'onglet courant
    }
    return Boolean(p);
  };

  const logout = () => {
    tokens.clear();
    setAuthed(false);
    setProfile(null);
    router.push("/login");
  };

  const canWrite = (moduleKey: string) =>
    Boolean(profile?.modules.find((m) => m.key === moduleKey)?.can_write);

  return (
    <Ctx.Provider
      value={{ authed, ready, profile, isAdmin: Boolean(profile?.is_admin), canWrite, signIn, logout }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);

/** Redirige vers /login si non authentifié. */
export function useRequireAuth() {
  const { authed, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (ready && !authed) router.replace("/login");
  }, [ready, authed, router]);
  return ready && authed;
}
