"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok = await signIn(u, p);
    setLoading(false);
    if (ok) router.replace("/");
    else setErr("Identifiants invalides ou compte non autorisé.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="HBC-RH" className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl">Dashboard HBC-RH</h1>
          <p className="mt-1 text-sm text-muted">Gestion du contenu du site</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Nom d&apos;utilisateur</label>
            <input className="input" value={u} onChange={(e) => setU(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" disabled={loading} className="btn-brand w-full">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </form>
    </div>
  );
}
