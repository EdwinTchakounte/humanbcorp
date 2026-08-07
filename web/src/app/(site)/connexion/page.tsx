"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, isStaffProfile } from "@/lib/api";
import { saveLearnerTokens } from "@/lib/learnerAuth";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3001";

/**
 * Connexion unifiée de la vitrine. Un seul formulaire, une redirection selon le
 * profil renvoyé par l'API :
 *  - staff / admin / formateur / recruteur → dashboard (leur outil de travail) ;
 *  - apprenant → son espace, ici même, via le JWT obtenu.
 */
export default function ConnexionPage() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setBusy(true);
    const r = await login(identifiant.trim(), motDePasse);
    setBusy(false);

    if (!r.ok || !r.data) {
      setErreur(r.detail || "Identifiants invalides.");
      return;
    }

    // Redirection par profil.
    if (isStaffProfile(r.data.profile)) {
      // Le staff se connecte sur son propre outil (sous-domaine dédié). On ne
      // conserve pas le jeton côté vitrine : il se ré-authentifie sur le dashboard.
      window.location.href = DASHBOARD_URL;
      return;
    }

    // Apprenant : on garde le JWT et on ouvre son espace ici.
    saveLearnerTokens(r.data.access, r.data.refresh);
    router.push("/mon-espace");
  }

  return (
    <section className="py-14 md:py-20">
      <div className="container-hbc">
        <div className="mx-auto max-w-md rounded-3xl border border-line/70 bg-white p-8 shadow-hbc-sm md:p-10">
          <p className="eyebrow">Espace membre</p>
          <h1 className="mt-1 text-2xl md:text-3xl">Connexion</h1>
          <p className="mt-2 text-sm text-muted">
            Connectez-vous pour accéder à votre espace. Vous serez dirigé automatiquement
            selon votre profil.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="identifiant" className="mb-1 block text-sm font-medium text-ink">
                E-mail
              </label>
              <input
                id="identifiant"
                type="text"
                autoComplete="username"
                required
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="vous@exemple.com"
                className="hbc-input w-full"
              />
            </div>

            <div>
              <label htmlFor="motdepasse" className="mb-1 block text-sm font-medium text-ink">
                Mot de passe
              </label>
              <input
                id="motdepasse"
                type="password"
                autoComplete="current-password"
                required
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="hbc-input w-full"
              />
            </div>

            {erreur && (
              <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <i className="bx bx-error-circle text-lg" /> {erreur}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-brand w-full justify-center disabled:opacity-50">
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            <strong className="text-ink">Première connexion ?</strong> Utilisez le lien d’accès
            reçu par e-mail pour définir votre mot de passe, puis revenez ici pour vous connecter.
          </p>
        </div>
      </div>
    </section>
  );
}
