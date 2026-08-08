"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ajouterAuPanier,
  commanderPanier,
  getCatalogueApprenant,
  getMesApprenants,
  getPanier,
  getInscriptionStatus,
  payInscription,
  retirerDuPanier,
  type ApprenantSuivi,
  type CatalogueItem,
  type LearnerSession,
  type Panier,
  type Participant,
} from "@/lib/api";

/**
 * Souscrire à d'autres formations depuis son espace — pour soi ou pour des proches.
 *
 * Le cas dimensionnant est le parent qui inscrit plusieurs enfants : on empile
 * des lignes (formation × apprenant) et on règle **une seule fois**. Chaque
 * enfant reçoit ensuite son propre accès par e-mail ; le parent garde le suivi.
 */

function fmtPrix(v: string | number | null): string {
  const n = Number(v ?? 0);
  if (!n) return "Gratuit";
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

const RESEAUX = [
  { value: "MTN", label: "MTN MoMo" },
  { value: "ORANGE", label: "Orange Money" },
];

/** Saisie des personnes à inscrire sur une formation donnée. */
function ChoixParticipants({
  formation,
  onValider,
  onAnnuler,
  busy,
}: {
  formation: CatalogueItem;
  onValider: (p: Participant[], pourMoi: boolean) => void;
  onAnnuler: () => void;
  busy: boolean;
}) {
  const [pourMoi, setPourMoi] = useState(!formation.deja_inscrit);
  const [autres, setAutres] = useState<Participant[]>([]);

  function maj(i: number, champ: keyof Participant, valeur: string) {
    setAutres((prev) => prev.map((p, k) => (k === i ? { ...p, [champ]: valeur } : p)));
  }

  const valides = autres.filter((p) => p.first_name.trim() && p.email.includes("@"));
  const rien = !pourMoi && valides.length === 0;

  return (
    <div className="mt-4 rounded-md border border-line bg-paper p-4">
      <p className="mb-3 font-heading text-sm font-semibold text-brand-deep">Qui suivra « {formation.title} » ?</p>

      <label
        className={`flex items-center gap-2 text-sm ${
          formation.deja_inscrit ? "cursor-not-allowed text-muted" : "cursor-pointer"
        }`}
      >
        <input
          type="checkbox"
          checked={pourMoi}
          disabled={formation.deja_inscrit}
          onChange={(e) => setPourMoi(e.target.checked)}
        />
        Moi-même
        {formation.deja_inscrit && <span className="text-xs">(déjà inscrit)</span>}
      </label>

      {autres.map((p, i) => (
        // Ces cartes vivent dans une grille à deux colonnes : trois champs sur une
        // même ligne y deviennent illisibles. On empile plutôt qu'on ne comprime.
        <div key={i} className="mt-3 rounded-md border border-line bg-white p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Apprenant {i + 1}
            </span>
            <button
              type="button"
              className="text-muted transition hover:text-accent"
              onClick={() => setAutres((prev) => prev.filter((_, k) => k !== i))}
              aria-label="Retirer cette personne"
            >
              <i className="bx bx-trash text-lg" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="hbc-input"
              placeholder="Prénom *"
              value={p.first_name}
              onChange={(e) => maj(i, "first_name", e.target.value)}
            />
            <input
              className="hbc-input"
              placeholder="Nom"
              value={p.last_name ?? ""}
              onChange={(e) => maj(i, "last_name", e.target.value)}
            />
          </div>
          <input
            className="hbc-input mt-2"
            type="email"
            placeholder="E-mail *"
            value={p.email}
            onChange={(e) => maj(i, "email", e.target.value)}
          />
        </div>
      ))}

      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent"
        onClick={() => setAutres((prev) => [...prev, { first_name: "", last_name: "", email: "" }])}
      >
        <i className="bx bx-plus" /> Ajouter une autre personne
      </button>

      {/* L'e-mail sert d'identité : c'est là que part l'accès de chacun.
          Une même adresse peut servir à plusieurs enfants — le back crée un
          compte distinct par personne et envoie un lien d'accès par enfant. */}
      {autres.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Chaque personne reçoit son propre lien d’accès. Vous pouvez indiquer la
          <strong> même adresse e-mail pour plusieurs enfants</strong> — ils recevront
          chacun leur lien à cette adresse.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-brand"
          disabled={rien || busy}
          onClick={() => onValider(valides, pourMoi)}
        >
          {busy ? "Ajout…" : "Ajouter au panier"}
        </button>
        <button type="button" className="btn-outline-brand" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
      {rien && <p className="mt-2 text-xs text-muted">Sélectionnez au moins une personne.</p>}
    </div>
  );
}

/** Étape de règlement mobile money, une fois la commande créée. */
function Paiement({ orderToken, montant, onPaye }: { orderToken: string; montant: string; onPaye: () => void }) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("MTN");
  const [etat, setEtat] = useState<"saisie" | "attente" | "paye">("saisie");
  const [msg, setMsg] = useState("");

  // Le paiement se confirme côté serveur (webhook) : on interroge l'état plutôt
  // que de croire la réponse du push, qui ne dit que « demande envoyée ».
  useEffect(() => {
    if (etat !== "attente") return;
    const t = setInterval(async () => {
      const s = await getInscriptionStatus(orderToken);
      if (s?.paid) {
        clearInterval(t);
        setEtat("paye");
        onPaye();
      }
    }, 4000);
    return () => clearInterval(t);
  }, [etat, orderToken, onPaye]);

  if (etat === "paye")
    return (
      <div className="rounded-md border border-line bg-paper p-4 text-sm">
        <i className="bx bx-check-circle mr-1 text-lg text-green-600" />
        Paiement confirmé. Chaque apprenant reçoit son accès par e-mail.
      </div>
    );

  if (etat === "attente")
    return (
      <div className="rounded-md border border-line bg-paper p-4 text-sm">
        <i className="bx bx-loader-alt mr-1 animate-spin text-lg" />
        Validez la demande sur votre téléphone ({network}). Cette page se met à jour toute seule.
      </div>
    );

  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <p className="mb-3 font-heading text-sm font-semibold text-brand-deep">Régler {fmtPrix(montant)}</p>
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
        <input
          className="hbc-input"
          placeholder="Numéro mobile money"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <select className="hbc-input" value={network} onChange={(e) => setNetwork(e.target.value)}>
          {RESEAUX.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          className="btn-brand"
          disabled={!phone.trim()}
          onClick={async () => {
            setMsg("");
            const r = await payInscription(orderToken, { phone: phone.trim(), network });
            if (r.ok) setEtat("attente");
            else setMsg(r.data?.detail || "Le paiement n’a pas pu être lancé.");
          }}
        >
          Payer
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-accent">{msg}</p>}
    </div>
  );
}

export default function Souscrire({ session, onChangement }: { session: LearnerSession; onChangement?: () => void }) {
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [panier, setPanier] = useState<Panier | null>(null);
  const [suivis, setSuivis] = useState<ApprenantSuivi[]>([]);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");
  const [commande, setCommande] = useState<{ token: string; montant: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const recharger = useCallback(async () => {
    const [c, p, s] = await Promise.all([
      getCatalogueApprenant(session),
      getPanier(session),
      getMesApprenants(session),
    ]);
    setCatalogue(c);
    setPanier(p);
    setSuivis(s);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  async function ajouter(f: CatalogueItem, participants: Participant[], pourMoi: boolean) {
    setBusy(true);
    setFlash("");
    const r = await ajouterAuPanier(session, f.id, participants, pourMoi);
    setBusy(false);
    if (!r.ok) {
      setFlash(r.detail);
      return;
    }
    setOuvert(null);
    // Les refus partiels (déjà inscrit, session complète) doivent se voir : sans
    // cela, l'utilisateur croit avoir ajouté trois enfants et n'en retrouve qu'un.
    const ignores = r.data?.ignores ?? [];
    setFlash(
      ignores.length
        ? `Ajouté. Non retenu : ${ignores.map((i) => `${i.email} (${i.raison})`).join(", ")}.`
        : "Ajouté au panier."
    );
    await recharger();
  }

  async function retirer(inscriptionId: number) {
    const r = await retirerDuPanier(session, inscriptionId);
    if (r.ok) await recharger();
  }

  async function commander() {
    setBusy(true);
    setFlash("");
    const r = await commanderPanier(session);
    setBusy(false);
    if (!r.ok || !r.data) {
      setFlash(r.detail);
      return;
    }
    if (r.data.paid) {
      setFlash("Inscription confirmée. L’accès part par e-mail.");
      await recharger();
      onChangement?.();
      return;
    }
    setCommande({ token: r.data.order_token ?? "", montant: r.data.amount });
    await recharger();
  }

  if (loading) return <p className="text-muted">Chargement du catalogue…</p>;

  const dispo = catalogue.filter((f) => !f.complete);
  // Regroupement par catégorie (fallback « Autres formations ») pour une
  // navigation claire du catalogue depuis l'espace apprenant.
  const groupes = Array.from(
    dispo.reduce((m, f) => {
      const cle = f.categorie_name?.trim() || "Autres formations";
      (m.get(cle) ?? m.set(cle, []).get(cle))!.push(f);
      return m;
    }, new Map<string, CatalogueItem[]>())
  );

  return (
    <div className="space-y-8">
      {flash && (
        <p className="rounded-md border border-line bg-paper px-4 py-3 text-sm">{flash}</p>
      )}

      {/* --- Panier --- */}
      {panier && panier.nb_lignes > 0 && (
        <section className="card-soft p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-lg">Mon panier</h3>
            <span className="text-sm text-muted">
              {panier.nb_lignes} inscription{panier.nb_lignes > 1 ? "s" : ""} ·{" "}
              {panier.nb_participants} apprenant{panier.nb_participants > 1 ? "s" : ""}
            </span>
          </div>

          <ul className="divide-y divide-line">
            {panier.lignes.map((l) => (
              <li key={l.inscription_id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.formation}</p>
                  <p className="truncate text-sm text-muted">
                    {l.participant.nom} · {l.participant.email}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{fmtPrix(l.prix)}</span>
                <button
                  className="shrink-0 px-1 text-muted transition hover:text-accent"
                  onClick={() => retirer(l.inscription_id)}
                  aria-label="Retirer du panier"
                >
                  <i className="bx bx-trash text-lg" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
            <span className="font-heading text-lg">Total {fmtPrix(panier.total)}</span>
            {!commande && (
              <button className="btn-brand" disabled={busy} onClick={commander}>
                {busy ? "…" : "Commander"}
              </button>
            )}
          </div>

          {commande?.token && (
            <div className="mt-4">
              <Paiement
                orderToken={commande.token}
                montant={commande.montant}
                onPaye={() => {
                  setCommande(null);
                  recharger();
                  onChangement?.();
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* --- Catalogue --- */}
      <section>
        <h3 className="mb-1 font-heading text-lg">Découvrir d’autres formations</h3>
        <p className="mb-4 text-sm text-muted">
          Inscrivez-vous, ou inscrivez vos proches — un seul paiement pour tout le panier.
        </p>

        {dispo.length === 0 ? (
          <p className="text-muted">Aucune autre formation ouverte pour le moment.</p>
        ) : (
          <div className="space-y-8">
            {groupes.map(([categorie, items]) => (
              <div key={categorie}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="eyebrow">{categorie}</span>
                  <span className="text-xs font-medium text-muted">({items.length})</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {items.map((f) => {
                    // « Gratuit » = prix explicite à 0 ; `null` = prix masqué (sur demande).
                    const gratuit = f.price !== null && !Number(f.price);
                    return (
                      <article key={f.id} className="card-soft flex flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-heading font-semibold">{f.title}</h4>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${
                              gratuit ? "bg-green-100 text-green-700" : "text-accent"
                            }`}
                          >
                            {f.price === null ? "Prix sur demande" : gratuit ? "Gratuit" : fmtPrix(f.price)}
                          </span>
                        </div>
                        {f.description && (
                          <p className="mt-2 line-clamp-3 text-sm text-muted">{f.description}</p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                          {f.deja_inscrit && (
                            <span className="rounded-sm bg-brand/10 px-2 py-0.5 text-brand-deep">
                              Vous y êtes inscrit
                            </span>
                          )}
                          {f.au_panier && (
                            <span className="rounded-sm bg-paper px-2 py-0.5">Déjà au panier</span>
                          )}
                          {f.places_restantes !== null && f.places_restantes !== undefined && (
                            <span>{f.places_restantes} place(s) restante(s)</span>
                          )}
                        </div>

                        {ouvert === f.id ? (
                          <ChoixParticipants
                            formation={f}
                            busy={busy}
                            onAnnuler={() => setOuvert(null)}
                            onValider={(p, moi) => ajouter(f, p, moi)}
                          />
                        ) : (
                          <button
                            className={`mt-4 w-full justify-center sm:w-auto ${gratuit ? "btn-brand" : "btn-accent"}`}
                            onClick={() => setOuvert(f.id)}
                          >
                            <i className={`bx ${gratuit ? "bx-check-circle" : "bx-cart-add"} mr-1`} />
                            {gratuit ? "S’inscrire gratuitement" : "S’inscrire / Payer"}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* --- Suivi des personnes inscrites par moi --- */}
      {suivis.length > 0 && (
        <section>
          <h3 className="mb-1 font-heading text-lg">Les apprenants que j’ai inscrits</h3>
          <p className="mb-4 text-sm text-muted">
            Vous voyez leur inscription et leur accès. Leurs résultats de quiz leur appartiennent.
          </p>
          <div className="space-y-3">
            {suivis.map((a) => (
              <div key={a.email} className="card-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.nom}</p>
                    <p className="text-sm text-muted">{a.email}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {a.compte_actif ? "Compte activé" : "N’a pas encore défini son mot de passe"}
                  </span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {a.formations.map((f) => (
                    <li key={`${f.commande_id}-${f.publication_id}`} className="flex items-center gap-2">
                      <i
                        className={`bx ${
                          f.confirmee ? "bx-check-circle text-green-600" : "bx-time text-muted"
                        }`}
                      />
                      <span className="flex-1">{f.titre}</span>
                      <span className="text-xs text-muted">
                        {f.confirmee ? "Accès actif" : f.payee ? "En cours" : "Paiement en attente"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
