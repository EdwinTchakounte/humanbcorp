"use client";

import { useEffect, useState } from "react";
import {
  createInscription,
  payInscription,
  getInscriptionStatus,
  type PublicFormation,
  type Lang,
} from "@/lib/api";
import { useCart } from "@/lib/cart";

const L = {
  fr: {
    free: "Gratuit",
    onRequest: "Prix sur demande",
    register: "S’inscrire",
    firstName: "Prénom",
    lastName: "Nom",
    email: "Email",
    saving: "Enregistrement…",
    validateFree: "Valider mon inscription",
    continue: "Continuer vers le paiement",
    payIntro:
      "Inscription enregistrée. Réglez les frais par Mobile Money : un push de paiement sera envoyé sur votre téléphone.",
    phone: "Téléphone (MoMo / Orange Money)",
    network: "Réseau",
    initiating: "Initiation…",
    pay: "Payer",
    validatePhone: "Validez sur votre téléphone",
    pushSent: "Une demande de paiement a été envoyée. Confirmez-la avec votre code Mobile Money.",
    waiting: "En attente de confirmation…",
    doneFree: "Inscription confirmée !",
    donePaid: "Paiement confirmé, merci !",
    doneText: "Un email de confirmation vous a été envoyé. Notre équipe vous recontacte pour la suite.",
    errRegister: "Échec de l'inscription.",
    errPay: "Échec de l'initiation du paiement.",
    addToCart: "Ajouter au panier",
    added: "Ajouté au panier ✓",
    forWhom: "Pour qui ?",
    forMe: "C’est pour moi",
    learnerFirst: "Prénom de l’apprenant",
    learnerLast: "Nom de l’apprenant",
    learnerEmail: "E-mail de l’apprenant",
    sharedEmailHint:
      "Pour plusieurs enfants sous une même adresse, réutilisez le même e-mail : chacun recevra son propre accès.",
    directLink: "Ou s’inscrire directement (1 personne)",
    backToCart: "← Ajouter au panier",
  },
  en: {
    free: "Free",
    onRequest: "Price on request",
    register: "Register",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    saving: "Saving…",
    validateFree: "Confirm my registration",
    continue: "Continue to payment",
    payIntro:
      "Registration saved. Pay the fee via Mobile Money: a payment push will be sent to your phone.",
    phone: "Phone (MoMo / Orange Money)",
    network: "Network",
    initiating: "Initiating…",
    pay: "Pay",
    validatePhone: "Confirm on your phone",
    pushSent: "A payment request has been sent. Confirm it with your Mobile Money PIN.",
    waiting: "Waiting for confirmation…",
    doneFree: "Registration confirmed!",
    donePaid: "Payment confirmed, thank you!",
    doneText: "A confirmation email has been sent. Our team will get back to you.",
    errRegister: "Registration failed.",
    errPay: "Payment initiation failed.",
    addToCart: "Add to cart",
    added: "Added to cart ✓",
    forWhom: "For whom?",
    forMe: "It’s for me",
    learnerFirst: "Learner’s first name",
    learnerLast: "Learner’s last name",
    learnerEmail: "Learner’s email",
    sharedEmailHint:
      "For several children under one address, reuse the same email: each gets their own access.",
    directLink: "Or register directly (1 person)",
    backToCart: "← Add to cart",
  },
} as const;

function fmtPrice(v: string | null, freeLabel: string, onRequest: string) {
  // Prix MASQUÉ (null) ≠ prix nul : annoncer « Gratuit » serait un contresens.
  if (v == null) return onRequest;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!n) return freeLabel;
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

type Step = "form" | "pay" | "pending" | "done";

// « du 12 mars au 20 mars 2026 » — ou la seule date de début si la fin manque.
function fmtSession(debut: string, fin: string | null, lang: "fr" | "en") {
  const loc = lang === "en" ? "en-GB" : "fr-FR";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
  const d = new Date(debut).toLocaleDateString(loc, opts);
  if (!fin) return lang === "en" ? `From ${d}` : `À partir du ${d}`;
  const f = new Date(fin).toLocaleDateString(loc, opts);
  return lang === "en" ? `${d} → ${f}` : `Du ${d} au ${f}`;
}

export default function InscriptionWidget({
  formation,
  lang = "fr",
}: {
  formation: PublicFormation;
  lang?: Lang;
}) {
  const t = L[lang];
  const { addLine } = useCart();
  // Deux parcours coexistent : panier multi-personnes (par défaut) et
  // inscription directe (1 personne, secondaire).
  const [mode, setMode] = useState<"cart" | "direct">("cart");
  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Ajout au panier
  const [cForMe, setCForMe] = useState(false);
  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [added, setAdded] = useState(false);

  // identité invité
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // paiement
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [payMsg, setPayMsg] = useState("");

  const free = Number(String(formation.price).replace(/\s/g, "").replace(",", ".")) === 0;
  // Prix masqué (« sur demande ») : impossible d'ajouter au panier — on ne
  // laisse alors que l'inscription directe (prise en charge au cas par cas).
  const priceMasked = formation.price == null;

  function onAddToCart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    addLine({
      formationId: formation.id,
      title: formation.title,
      price: String(formation.price ?? "0"),
      forMe: cForMe,
      first_name: cForMe ? "" : cFirst,
      last_name: cForMe ? "" : cLast,
      email: cForMe ? "" : cEmail.trim().toLowerCase(),
    });
    setAdded(true);
    setCFirst("");
    setCLast("");
    setCEmail("");
    setCForMe(false);
    setTimeout(() => setAdded(false), 2500);
  }

  async function onInscrire(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await createInscription({
      formation_id: formation.id,
      first_name: firstName,
      last_name: lastName,
      email,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.data?.detail || t.errRegister);
      return;
    }
    setToken(res.data.order_token);
    setStep(free ? "done" : "pay");
  }

  async function onPayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await payInscription(token, { phone });
    setBusy(false);
    if (!res.ok) {
      setErr(res.data?.detail || t.errPay);
      return;
    }
    setPayMsg(res.data.detail || "");
    setStep("pending");
  }

  // Polling du statut une fois le paiement initié
  useEffect(() => {
    if (step !== "pending" || !token) return;
    let alive = true;
    const timer = setInterval(async () => {
      const s = await getInscriptionStatus(token);
      if (alive && s?.paid) {
        clearInterval(timer);
        setStep("done");
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [step, token]);

  return (
    <div className="rounded-2xl border border-line/70 bg-white p-6 shadow-hbc md:p-8">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h3 className="text-lg">{t.register}</h3>
        <span className="text-xl font-bold text-brand">{fmtPrice(formation.price, t.free, t.onRequest)}</span>
      </div>

      {/* Session à dates fixes : l'acheteur voit les dates et les places avant
          de s'engager. Une session pleine n'affiche pas de formulaire — le back
          refuse de toute façon la dernière place en 409. */}
      {formation.mode === 1 && (formation.date_debut || formation.places_restantes !== null) && (
        <div className="mb-5 rounded-xl border border-line/70 bg-brand-soft/30 p-3 text-sm">
          {formation.date_debut && (
            <p className="flex items-center gap-1.5 text-ink">
              <i className="bx bx-calendar text-brand" />
              {fmtSession(formation.date_debut, formation.date_fin, lang)}
            </p>
          )}
          {formation.places_restantes !== null && !formation.complete && (
            <p className="mt-1 flex items-center gap-1.5 text-muted">
              <i className="bx bx-group text-brand" />
              {formation.places_restantes} {lang === "en" ? "seat(s) left" : "place(s) restante(s)"}
            </p>
          )}
        </div>
      )}

      {formation.complete ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
          <i className="bx bx-lock-alt" />{" "}
          {lang === "en" ? "This session is full." : "Cette session est complète."}
        </p>
      ) : mode === "cart" && !priceMasked ? (
      <>
        <form onSubmit={onAddToCart} className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line/70 bg-brand-soft/20 px-3 py-2.5 text-sm font-medium text-ink sm:col-span-2">
            <input
              type="checkbox"
              checked={cForMe}
              onChange={(e) => setCForMe(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--accent,#e2725b)]"
            />
            {t.forMe}
          </label>
          {!cForMe && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.learnerFirst} <span className="text-accent">*</span>
                </label>
                <input value={cFirst} onChange={(e) => setCFirst(e.target.value)} required className="hbc-input" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.learnerLast}
                </label>
                <input value={cLast} onChange={(e) => setCLast(e.target.value)} className="hbc-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  {t.learnerEmail} <span className="text-accent">*</span>
                </label>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  required
                  className="hbc-input"
                  placeholder="apprenant@exemple.com"
                />
                <p className="mt-1.5 text-xs text-muted">{t.sharedEmailHint}</p>
              </div>
            </>
          )}
          <button type="submit" className="btn-accent sm:col-span-2">
            <i className="bx bx-cart-add" aria-hidden /> {t.addToCart}
          </button>
        </form>
        {added && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
            <i className="bx bx-check-circle text-lg" /> {t.added}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMode("direct");
            setStep("form");
          }}
          className="mt-4 block w-full text-center text-sm font-medium text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          {t.directLink}
        </button>
      </>
      ) : (
      <>
      {!priceMasked && (
        <button
          type="button"
          onClick={() => setMode("cart")}
          className="mb-3 text-sm font-medium text-muted transition-colors hover:text-accent"
        >
          {t.backToCart}
        </button>
      )}
      {step === "form" && (
        <form onSubmit={onInscrire} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t.firstName} <span className="text-accent">*</span>
            </label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="hbc-input" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.lastName}</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="hbc-input" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t.email} <span className="text-accent">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="hbc-input"
              placeholder="vous@exemple.com"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-accent sm:col-span-2">
            {busy ? t.saving : free ? t.validateFree : t.continue}
          </button>
        </form>
      )}

      {step === "pay" && (
        <form onSubmit={onPayer} className="grid gap-4">
          <p className="text-sm text-muted">{t.payIntro}</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t.phone} <span className="text-accent">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="hbc-input"
              placeholder="6XXXXXXXX"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-accent">
            {busy ? t.initiating : `${t.pay} ${fmtPrice(formation.price, t.free, t.onRequest)}`}
          </button>
        </form>
      )}

      {step === "pending" && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-3xl text-brand">
            <i className="bx bx-mobile-alt bx-tada" />
          </div>
          <h4 className="text-base font-semibold text-ink">{t.validatePhone}</h4>
          <p className="mt-2 text-sm text-muted">{payMsg || t.pushSent}</p>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
            <i className="bx bx-loader-alt bx-spin" /> {t.waiting}
          </p>
        </div>
      )}

      {step === "done" && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-3xl text-green-600">
            <i className="bx bx-check-circle" />
          </div>
          <h4 className="text-base font-semibold text-ink">{free ? t.doneFree : t.donePaid}</h4>
          <p className="mt-2 text-sm text-muted">{t.doneText}</p>
        </div>
      )}

      {err && (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <i className="bx bx-error-circle text-lg" /> {err}
        </p>
      )}
      </>
      )}
    </div>
  );
}
