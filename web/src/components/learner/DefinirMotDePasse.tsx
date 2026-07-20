"use client";

import { useState } from "react";

// L'URL de l'API est publique (NEXT_PUBLIC_*) : lisible côté navigateur.
const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8011";

/**
 * Activation d'un compte apprenant : définition du mot de passe.
 *
 * Le jeton du lien magique — reçu par e-mail — sert de preuve d'identité : il
 * prouve la possession de l'adresse, donc autorise à poser un mot de passe sans
 * étape de vérification supplémentaire.
 *
 * Une fois activé, l'apprenant peut se connecter par e-mail + mot de passe et
 * n'a plus besoin de retrouver son lien magique (qui expire au bout de 6 mois).
 */
const MIN = 8;

export default function DefinirMotDePasse({ token }: { token: string }) {
  const [mdp, setMdp] = useState("");
  const [confirme, setConfirme] = useState("");
  const [busy, setBusy] = useState(false);
  const [fait, setFait] = useState(false);
  const [erreur, setErreur] = useState("");

  const trop_court = mdp.length > 0 && mdp.length < MIN;
  const discordant = confirme.length > 0 && confirme !== mdp;
  const pret = mdp.length >= MIN && confirme === mdp && !busy;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!pret) return;
    setBusy(true);
    setErreur("");
    try {
      const res = await fetch(`${API}/api/v1/site/mon-espace/${token}/compte/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: mdp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.detail || "L'activation a échoué.");
        return;
      }
      setFait(true);
    } catch {
      setErreur("Réseau indisponible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (fait) {
    return (
      <div className="card-soft p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-green-50 text-3xl text-green-600">
          <i className="bx bx-check" />
        </div>
        <h2 className="text-xl">Mot de passe défini</h2>
        <p className="mt-2 text-muted">
          Vous pouvez désormais vous connecter avec votre adresse e-mail et ce mot de passe,
          sans avoir à retrouver votre lien d&apos;accès.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="card-soft p-8">
      <p className="eyebrow">Votre compte</p>
      <h2 className="mt-2 text-xl">Définir votre mot de passe</h2>
      <p className="mt-2 text-sm text-muted">
        Choisissez un mot de passe pour accéder à votre espace quand vous le souhaitez —
        votre lien d&apos;accès par e-mail, lui, finit par expirer.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="mdp">
            Mot de passe ({MIN} caractères minimum)
          </label>
          <input
            id="mdp"
            type="password"
            autoComplete="new-password"
            className="hbc-input"
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            required
          />
          {trop_court && (
            <p className="mt-1 text-xs text-red-600">Encore {MIN - mdp.length} caractère(s).</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="mdp2">
            Confirmer le mot de passe
          </label>
          <input
            id="mdp2"
            type="password"
            autoComplete="new-password"
            className="hbc-input"
            value={confirme}
            onChange={(e) => setConfirme(e.target.value)}
            required
          />
          {discordant && (
            <p className="mt-1 text-xs text-red-600">Les deux saisies diffèrent.</p>
          )}
        </div>
      </div>

      {erreur && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {erreur}
        </p>
      )}

      <button type="submit" disabled={!pret} className="btn-accent mt-6 w-full disabled:opacity-50">
        {busy ? "Enregistrement…" : "Définir mon mot de passe"}
      </button>
    </form>
  );
}
