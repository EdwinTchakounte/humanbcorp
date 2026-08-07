"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LearnerSpace from "@/components/learner/LearnerSpace";
import { clearLearnerTokens, getLearnerAccess } from "@/lib/learnerAuth";
import type { LearnerSession } from "@/lib/api";

/**
 * Espace apprenant par COMPTE (e-mail + mot de passe). Lit le JWT stocké après
 * connexion ; sans jeton, renvoie vers /connexion. Réutilise exactement le même
 * composant que l'accès par lien magique — seule la voie d'accès change.
 */
export default function MonEspaceCompte() {
  const router = useRouter();
  const [access, setAccess] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const a = getLearnerAccess();
    if (!a) {
      router.replace("/connexion");
      return;
    }
    setAccess(a);
    setChecked(true);
  }, [router]);

  const session: LearnerSession | null = useMemo(
    () => (access ? { kind: "jwt", access } : null),
    [access]
  );

  function logout() {
    clearLearnerTokens();
    router.replace("/connexion");
  }

  if (!checked || !session) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-3 text-muted">
        <i className="bx bx-loader-alt animate-spin text-4xl text-brand" />
        <p className="text-sm font-medium">Chargement de votre espace…</p>
      </div>
    );
  }

  return (
    <section className="py-10 md:py-14">
      <div className="px-safe">
        <div className="w-full px-2 sm:px-3">
          <LearnerSpace session={session} onLogout={logout} />
        </div>
      </div>
    </section>
  );
}
