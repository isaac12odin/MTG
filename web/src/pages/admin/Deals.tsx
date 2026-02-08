import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const statusOptions = [
  "",
  "SOLD",
  "PAYMENT_CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
  "CANCELED",
  "UNPAID_RELISTED",
] as const;

type DealRow = {
  id: string;
  status: string;
  createdAt: string;
  listing?: { title?: string | null } | null;
  buyer?: { profile?: { displayName?: string | null } | null } | null;
  seller?: { profile?: { displayName?: string | null } | null } | null;
  shipment?: { status?: string | null } | null;
};

export function Deals() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (status) params.set("status", status);
    const res = await apiFetch<{ data: DealRow[] }>(`/admin/deals?${params.toString()}`);
    setDeals(res.data);
  };

  useEffect(() => {
    load().catch(() => setDeals([]));
  }, [status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventas"
        subtitle="Historial de ventas, pagos y entregas."
        action={
          <select
            className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s || "Todas"}
              </option>
            ))}
          </select>
        }
      />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="space-y-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{deal.listing?.title ?? "Venta"}</p>
                <p className="text-xs text-slate-400">
                  {deal.seller?.profile?.displayName ?? "Vendedor"} → {deal.buyer?.profile?.displayName ?? "Comprador"}
                </p>
                <p className="text-xs text-slate-500">{new Date(deal.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-xs text-slate-300">
                <div>Estado: {deal.status}</div>
                <div>Envío: {deal.shipment?.status ?? "—"}</div>
              </div>
            </div>
          ))}
          {!deals.length && <p className="text-sm text-slate-400">Sin ventas.</p>}
        </div>
      </div>
    </div>
  );
}
