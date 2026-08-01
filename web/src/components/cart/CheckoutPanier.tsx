"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  checkoutPanier,
  payInscription,
  getInscriptionStatus,
  type CheckoutItem,
  type Lang,
} from "@/lib/api";
import {
  useCart,
  getSavedAddresses,
  saveAddress,
  type SavedAddress,
} from "@/lib/cart";

const L = {
  fr: {
    title: "Finaliser ma commande",
    empty: "Votre panier est vide.",
    browse: "Voir les formations",
    summary: "Récapitulatif",
    forMe: "Pour moi",
    total: "Total",
    free: "Gratuit",
    buyer: "Vos coordonnées (acheteur)",
    firstName: "Prénom",
    lastName: "Nom",
    email: "E-mail",
    emailHint: "Le reçu et le suivi de commande sont envoyés à cette adresse.",
    address: "Adresse",
    savedAddresses: "Adresses enregistrées",
    line1: "Adresse (rue, quartier)",
    line2: "Complément",
    city: "Ville",
    region: "Région",
    country: "Pays",
    payment: "Paiement Mobile Money",
    phone: "Téléphone (MoMo / Orange Money)",
    networkAuto: "Le réseau (MTN / Orange) est détecté automatiquement depuis votre numéro.",
    pay: "Payer",
    validateFree: "Valider ma commande",
    processing: "Traitement…",
    validatePhone: "Validez sur votre téléphone",
    pushSent: "Une demande de paiement a été envoyée. Confirmez-la avec votre code Mobile Money.",
    waiting: "En attente de confirmation…",
    donePaid: "Paiement confirmé, merci !",
    doneFree: "Commande confirmée !",
    doneText:
      "Chaque apprenant reçoit par e-mail un lien pour accéder à son espace et définir son mot de passe.",
    errCheckout: "Impossible de créer la commande.",
    errPay: "Échec de l'initiation du paiement.",
    ignored: "Certaines lignes n'ont pas été retenues :",
    required: "Renseignez vos coordonnées et un numéro de paiement.",
  },
  en: {
    title: "Complete my order",
    empty: "Your cart is empty.",
    browse: "Browse trainings",
    summary: "Summary",
    forMe: "For myself",
    total: "Total",
    free: "Free",
    buyer: "Your details (buyer)",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    emailHint: "The receipt and order tracking are sent to this address.",
    address: "Address",
    savedAddresses: "Saved addresses",
    line1: "Address (street, district)",
    line2: "Complement",
    city: "City",
    region: "Region",
    country: "Country",
    payment: "Mobile Money payment",
    phone: "Phone (MoMo / Orange Money)",
    networkAuto: "The network (MTN / Orange) is detected automatically from your number.",
    pay: "Pay",
    validateFree: "Confirm my order",
    processing: "Processing…",
    validatePhone: "Confirm on your phone",
    pushSent: "A payment request has been sent. Confirm it with your Mobile Money PIN.",
    waiting: "Waiting for confirmation…",
    donePaid: "Payment confirmed, thank you!",
    doneFree: "Order confirmed!",
    doneText:
      "Each learner receives an email link to access their space and set their password.",
    errCheckout: "Could not create the order.",
    errPay: "Payment initiation failed.",
    ignored: "Some lines were not kept:",
    required: "Fill in your details and a payment number.",
  },
} as const;

function fmt(n: number, free: string) {
  if (!n) return free;
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

type Step = "form" | "pending" | "done";

export default function CheckoutPanier({ lang = "fr" }: { lang?: Lang }) {
  const t = L[lang];
  const prefix = lang === "en" ? "/en" : "";
  const { lines, total, removeLine, clear } = useCart();

  const [step, setStep] = useState<Step>("form");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [payMsg, setPayMsg] = useState("");
  const [token, setToken] = useState("");
  const [ignored, setIgnored] = useState<{ email: string; formation?: string; raison: string }[]>([]);

  // Acheteur
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Adresse
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("Cameroun");
  const [saved, setSaved] = useState<SavedAddress[]>([]);

  // Paiement (le réseau est détecté par Tara depuis le numéro).
  const [phone, setPhone] = useState("");

  const free = total === 0;

  useEffect(() => {
    setSaved(getSavedAddresses());
  }, []);

  function applyAddress(a: SavedAddress) {
    setLine1(a.ligne1 || "");
    setLine2(a.ligne2 || "");
    setCity(a.ville || "");
    setRegion(a.region || "");
    setCountry(a.pays || "Cameroun");
    if (a.telephone) setPhone(a.telephone);
    if (a.nom_complet && !firstName && !lastName) {
      const [f, ...rest] = a.nom_complet.split(" ");
      setFirstName(f || "");
      setLastName(rest.join(" "));
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    if (!firstName.trim() || !email.trim() || (!free && !phone.trim())) {
      setErr(t.required);
      return;
    }
    setBusy(true);

    const items: CheckoutItem[] = lines.map((l) =>
      l.forMe
        ? { formation_id: l.formationId, pour_moi: true }
        : {
            formation_id: l.formationId,
            participant: { first_name: l.first_name, last_name: l.last_name, email: l.email },
          }
    );

    const res = await checkoutPanier({
      acheteur: { email: email.trim(), first_name: firstName.trim(), last_name: lastName.trim() },
      adresse: {
        ligne1: line1.trim(),
        ligne2: line2.trim(),
        ville: city.trim(),
        region: region.trim(),
        pays: country.trim(),
        telephone: phone.trim(),
      },
      items,
    });

    if (!res.ok || !res.data) {
      setBusy(false);
      setErr(res.data?.detail || t.errCheckout);
      return;
    }
    setIgnored(res.data.ignores || []);
    // Mémorise l'adresse pour l'autocomplétion future (local à l'appareil).
    saveAddress({
      nom_complet: `${firstName} ${lastName}`.trim(),
      telephone: phone.trim(),
      ligne1: line1.trim(),
      ligne2: line2.trim(),
      ville: city.trim(),
      region: region.trim(),
      pays: country.trim(),
    });

    // Commande gratuite : déjà confirmée côté serveur.
    if (res.data.paid || !res.data.order_token) {
      setBusy(false);
      clear();
      setStep("done");
      return;
    }

    // Sinon on initie le paiement Mobile Money sur le jeton de commande.
    const pay = await payInscription(res.data.order_token, { phone: phone.trim() });
    setBusy(false);
    if (!pay.ok) {
      setErr(pay.data?.detail || t.errPay);
      return;
    }
    setToken(res.data.order_token);
    setPayMsg(pay.data?.detail || "");
    setStep("pending");
  }

  // Polling du statut de paiement.
  useEffect(() => {
    if (step !== "pending" || !token) return;
    let alive = true;
    const timer = setInterval(async () => {
      const s = await getInscriptionStatus(token);
      if (alive && s?.paid) {
        clearInterval(timer);
        clear();
        setStep("done");
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [step, token, clear]);

  // Panier vide (hors écran de succès).
  if (lines.length === 0 && step !== "done") {
    return (
      <div className="container-hbc py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-4xl text-brand">
          <i className="bx bx-cart" />
        </div>
        <p className="text-lg font-medium text-ink">{t.empty}</p>
        <Link href={`${prefix}/formations`} className="btn-brand mt-5">
          {t.browse}
        </Link>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="container-hbc py-20 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-5xl text-green-600">
          <i className="bx bx-check-circle" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-brand-deep">{free ? t.doneFree : t.donePaid}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{t.doneText}</p>
        {ignored.length > 0 && (
          <div className="mx-auto mt-6 max-w-md rounded-xl bg-amber-50 p-4 text-left text-sm text-amber-800">
            <p className="mb-1 font-semibold">{t.ignored}</p>
            <ul className="list-inside list-disc">
              {ignored.map((ig, i) => (
                <li key={i}>
                  {ig.email} — {ig.formation ? `${ig.formation} : ` : ""}
                  {ig.raison}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link href={prefix || "/"} className="btn-brand mt-8">
          {lang === "en" ? "Back to home" : "Retour à l’accueil"}
        </Link>
      </div>
    );
  }

  if (step === "pending") {
    return (
      <div className="container-hbc py-20 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-4xl text-brand">
          <i className="bx bx-mobile-alt bx-tada" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-brand-deep">{t.validatePhone}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{payMsg || t.pushSent}</p>
        <p className="mt-6 flex items-center justify-center gap-2 text-muted">
          <i className="bx bx-loader-alt bx-spin" /> {t.waiting}
        </p>
      </div>
    );
  }

  return (
    <div className="container-hbc grid gap-8 py-10 lg:grid-cols-[1fr_360px] lg:py-14">
      {/* Formulaire */}
      <form onSubmit={onSubmit} className="order-2 space-y-8 lg:order-1">
        <h1 className="font-heading text-2xl font-bold text-brand-deep md:text-3xl">{t.title}</h1>

        {/* Acheteur */}
        <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-hbc-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-ink">
            <i className="bx bx-user-circle text-accent" /> {t.buyer}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="mt-1.5 text-xs text-muted">{t.emailHint}</p>
            </div>
          </div>
        </section>

        {/* Adresse */}
        <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-hbc-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-ink">
            <i className="bx bx-map text-accent" /> {t.address}
          </h2>
          {saved.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.savedAddresses}</p>
              <div className="flex flex-wrap gap-2">
                {saved.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyAddress(a)}
                    className="flex items-center gap-1.5 rounded-full border border-line bg-brand-soft/30 px-3 py-1.5 text-xs font-medium text-brand-deep transition-colors hover:border-brand hover:text-brand"
                  >
                    <i className="bx bx-map-pin text-accent" />
                    {[a.ligne1, a.ville].filter(Boolean).join(", ")}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.line1}</label>
              <input value={line1} onChange={(e) => setLine1(e.target.value)} className="hbc-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.line2}</label>
              <input value={line2} onChange={(e) => setLine2(e.target.value)} className="hbc-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.city}</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="hbc-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.region}</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} className="hbc-input" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{t.country}</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="hbc-input" />
            </div>
          </div>
        </section>

        {/* Paiement */}
        {!free && (
          <section className="rounded-2xl border border-line/70 bg-white p-5 shadow-hbc-sm md:p-6">
            <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-ink">
              <i className="bx bx-wallet text-accent" /> {t.payment}
            </h2>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                {t.phone} <span className="text-accent">*</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="hbc-input max-w-sm"
                placeholder="6XXXXXXXX"
              />
              <p className="mt-1.5 text-xs text-muted">{t.networkAuto}</p>
            </div>
          </section>
        )}

        {err && (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <i className="bx bx-error-circle text-lg" /> {err}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-accent w-full justify-center text-base">
          {busy ? t.processing : free ? t.validateFree : `${t.pay} ${fmt(total, t.free)}`}
        </button>
      </form>

      {/* Récapitulatif */}
      <aside className="order-1 lg:order-2">
        <div className="sticky top-24 rounded-2xl border border-line/70 bg-white p-5 shadow-hbc md:p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-ink">{t.summary}</h2>
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <i className="bx bx-user text-accent" />
                    {l.forMe ? t.forMe : `${l.first_name} ${l.last_name}`.trim() || l.email}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-brand">{fmt(Number(l.price), t.free)}</span>
                  <button
                    type="button"
                    onClick={() => removeLine(l.id)}
                    aria-label="Retirer"
                    className="text-muted transition-colors hover:text-red-600"
                  >
                    <i className="bx bx-trash" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-sm font-medium text-muted">{t.total}</span>
            <span className="font-heading text-xl font-bold text-brand-deep">{fmt(total, t.free)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
