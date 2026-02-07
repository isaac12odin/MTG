import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

type Payment = {
  id: string;
  status: string;
  periodEnd: string;
  periodStart: string;
  user: { id: string; profile?: { displayName?: string | null } | null };
  plan: { name: string; priceMXN: string };
};

export function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState("PENDIENTE");

  const load = async () => {
    const res = await apiFetch<{ data: Payment[] }>(
      `/admin/payments?status=${encodeURIComponent(filter)}&page=1&pageSize=50`
    );
    setPayments(res.data);
  };

  useEffect(() => {
    load().catch(() => setPayments([]));
  }, [filter]);

  const verify = async (id: string) => {
    await apiFetch(`/admin/payments/${id}/verify`, { method: "POST" });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos y renovaciones"
        subtitle="Alertas de mensualidades pendientes y vencidas."
        action={
          <div className="flex gap-2">
            {["PENDIENTE", "VENCIDO", "PAGADO"].map((status) => (
              <button
                key={status}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                  filter === status
                    ? "border-jade-400/50 bg-jade-500/10 text-jade-300"
                    : "border-white/10 text-white/70"
                }`}
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        }
      />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="space-y-3">
          {payments.map((pay) => (
            <div
              key={pay.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {pay.user.profile?.displayName ?? pay.user.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-400">
                  {pay.plan.name} • vence {new Date(pay.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">{pay.status}</span>
                {pay.status === "PENDIENTE" && (
                  <button
                    className="rounded-full bg-jade-500 px-3 py-1 text-xs font-semibold text-ink-950"
                    onClick={() => verify(pay.id)}
                  >
                    Marcar pagado
                  </button>
                )}
              </div>
            </div>
          ))}
          {!payments.length && <p className="text-sm text-slate-400">Sin alertas.</p>}
        </div>
      </div>
    </div>
  );
}
