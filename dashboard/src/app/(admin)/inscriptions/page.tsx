"use client";

import { useEffect, useState } from "react";
import { api, listAll } from "@/lib/api";
import { Modal, Pagination, PAGE_SIZE, TextField } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import type { InscriptionItem, OrderItem, InscriptionsOverview } from "@/lib/types";

function fmtAmount(v: string | number) {
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (!n) return "—";
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}
function fmtDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";
}

const INS_STYLE: Record<number, string> = {
  0: "bg-gray-100 text-gray-500",
  1: "bg-amber-50 text-amber-600",
  2: "bg-green-50 text-green-700",
  3: "bg-red-50 text-red-600",
};
const ORDER_STYLE: Record<number, string> = {
  1: "bg-amber-50 text-amber-600",
  2: "bg-green-50 text-green-700",
  3: "bg-blue-50 text-blue-600",
  4: "bg-red-50 text-red-600",
};

export default function InscriptionsPage() {
  const [tab, setTab] = useState<"inscriptions" | "orders">("inscriptions");
  const [ins, setIns] = useState<InscriptionItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [overview, setOverview] = useState<InscriptionsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const { canWrite } = useAuth();
  const writable = canWrite("inscriptions");
  const [busy, setBusy] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [payOrder, setPayOrder] = useState<OrderItem | null>(null);
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("MTN");

  function switchTab(t: "inscriptions" | "orders") {
    setTab(t);
    setPage(1);
  }

  async function reloadOrders() {
    const [o, ov] = await Promise.all([
      listAll<OrderItem>("/modules/orders/"),
      api<InscriptionsOverview>("/modules/inscriptions/overview/"),
    ]);
    setOrders(o);
    setOverview(ov);
  }

  async function encaisser(order: OrderItem) {
    if (!confirm(`Encaisser la commande #${order.id} (${fmtAmount(order.total_amount)}) en manuel ?`)) return;
    setBusy(order.id);
    setFlash(null);
    try {
      const res = await api<{ detail: string }>(`/modules/orders/${order.id}/encaisser/`, { method: "POST", body: {} });
      await reloadOrders();
      setFlash({ ok: true, msg: res.detail || "Encaissement enregistré." });
    } catch (e) {
      setFlash({ ok: false, msg: String(e).slice(0, 200) });
    } finally {
      setBusy(null);
    }
  }

  async function payerEnLigne() {
    if (!payOrder) return;
    setBusy(payOrder.id);
    setFlash(null);
    try {
      const res = await api<{ detail: string }>(`/modules/orders/${payOrder.id}/payer-en-ligne/`, {
        method: "POST",
        body: { phone, network },
      });
      await reloadOrders();
      setFlash({ ok: true, msg: res.detail || "Paiement initié." });
      setPayOrder(null);
      setPhone("");
    } catch (e) {
      setFlash({ ok: false, msg: String(e).slice(0, 200) });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    Promise.all([
      listAll<InscriptionItem>("/modules/inscriptions/"),
      listAll<OrderItem>("/modules/orders/"),
      api<InscriptionsOverview>("/modules/inscriptions/overview/"),
    ])
      .then(([i, o, ov]) => {
        setIns(i);
        setOrders(o);
        setOverview(ov);
      })
      .finally(() => setLoading(false));
  }, []);

  const pagedIns = ins.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tiles = overview
    ? [
        { label: "Inscriptions", value: overview.counts.inscriptions, icon: "bx-user-check" },
        { label: "Confirmées", value: overview.counts.confirmed, icon: "bx-check-circle" },
        { label: "Commandes", value: overview.counts.orders, icon: "bx-cart" },
        { label: "Total payé", value: fmtAmount(overview.total_orders_paid), icon: "bx-wallet", accent: true },
      ]
    : [];

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-2xl">Inscriptions &amp; Paniers</h1>
        <p className="text-sm text-muted">Inscriptions des participants et commandes.</p>
      </header>

      {flash && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            flash.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          <i className={`bx ${flash.ok ? "bx-check-circle" : "bx-error-circle"} text-lg`} />
          {flash.msg}
        </div>
      )}

      {overview && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          {tiles.map((s) => (
            <div key={s.label} className={`card flex items-center gap-4 p-5 ${s.accent ? "ring-1 ring-accent/30" : ""}`}>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${
                  s.accent ? "bg-accent/10 text-accent" : "bg-brand-soft text-brand"
                }`}
              >
                <i className={`bx ${s.icon}`} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-brand-deep">{s.value}</div>
                <div className="text-xs text-muted">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglets */}
      <div className="mb-4 flex gap-1 border-b border-line">
        {[
          { k: "inscriptions", label: `Inscriptions (${ins.length})` },
          { k: "orders", label: `Commandes (${orders.length})` },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => switchTab(t.k as typeof tab)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.k ? "border-accent text-accent" : "border-transparent text-muted hover:text-brand-deep"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Chargement…</p>
      ) : tab === "inscriptions" ? (
        ins.length === 0 ? (
          <p className="text-muted">Aucune inscription.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase text-muted">
                  <th className="px-5 py-3">Participant</th>
                  <th className="px-5 py-3">Formation / Publication</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {pagedIns.map((i) => (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-medium text-brand-deep">{i.participant_name}</td>
                    <td className="px-5 py-3">{i.publication_title}</td>
                    <td className="px-5 py-3 text-muted">{fmtDate(i.created_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${INS_STYLE[i.status] || ""}`}>
                        {i.status_label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 pb-4">
              <Pagination page={page} total={ins.length} onPage={setPage} />
            </div>
          </div>
        )
      ) : orders.length === 0 ? (
        <p className="text-muted">Aucune commande.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase text-muted">
                <th className="px-5 py-3">Acheteur</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Statut</th>
                {writable && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((o) => (
                <tr key={o.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3 font-medium text-brand-deep">{o.buyer_name}</td>
                  <td className="px-5 py-3 font-semibold">{fmtAmount(o.total_amount)}</td>
                  <td className="px-5 py-3 text-muted">{fmtDate(o.created_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ORDER_STYLE[o.status] || ""}`}>
                      {o.status_label}
                    </span>
                  </td>
                  {writable && (
                    <td className="px-5 py-3">
                      {o.status !== 2 ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => encaisser(o)}
                            disabled={busy === o.id}
                            className="btn-ghost text-xs disabled:opacity-50"
                            title="Encaissement manuel (saisie agence)"
                          >
                            <i className="bx bx-money" /> Encaisser
                          </button>
                          <button
                            onClick={() => { setPayOrder(o); setFlash(null); }}
                            disabled={busy === o.id}
                            className="btn-brand text-xs disabled:opacity-50"
                            title="Paiement mobile money (Tara)"
                          >
                            <i className="bx bx-mobile" /> Payer en ligne
                          </button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-green-600">Payée</div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 pb-4">
            <Pagination page={page} total={orders.length} onPage={setPage} />
          </div>
        </div>
      )}

      <Modal
        open={payOrder !== null}
        title={payOrder ? `Payer en ligne — commande #${payOrder.id}` : ""}
        onClose={() => setPayOrder(null)}
        footer={
          <>
            <button onClick={() => setPayOrder(null)} className="btn-ghost">
              Annuler
            </button>
            <button onClick={payerEnLigne} disabled={busy !== null || !phone} className="btn-brand disabled:opacity-50">
              {busy !== null ? "Initiation…" : "Envoyer la demande"}
            </button>
          </>
        }
      >
        {payOrder && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Montant : <span className="font-semibold text-brand-deep">{fmtAmount(payOrder.total_amount)}</span>.
              Un push de paiement (STK) sera envoyé sur le téléphone du client.
            </p>
            <TextField
              label="Téléphone (MoMo / Orange Money)"
              value={phone}
              onChange={setPhone}
              placeholder="6XXXXXXXX"
            />
            <div>
              <label className="label">Réseau</label>
              <select className="input" value={network} onChange={(e) => setNetwork(e.target.value)}>
                <option value="MTN">MTN Mobile Money</option>
                <option value="ORANGE">Orange Money</option>
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
