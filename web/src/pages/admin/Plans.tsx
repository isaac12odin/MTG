import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const typeOptions = ["SELLER", "STORE"] as const;

type PlanRow = {
  id: string;
  name: string;
  type: "SELLER" | "STORE";
  priceMXN: string | number;
  monthlyListingLimit?: number | null;
  activeListingLimit?: number | null;
  monthlyImageLimit?: number | null;
  maxImagesPerListing?: number | null;
  eventLimit?: number | null;
  isActive: boolean;
};

export function Plans() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    type: "SELLER" as "SELLER" | "STORE",
    priceMXN: "",
    monthlyListingLimit: "",
    activeListingLimit: "",
    monthlyImageLimit: "",
    maxImagesPerListing: "",
    eventLimit: "",
  });

  const load = async () => {
    const res = await apiFetch<{ data: PlanRow[] }>("/admin/plans?page=1&pageSize=50");
    setPlans(res.data);
  };

  useEffect(() => {
    load().catch(() => setPlans([]));
  }, []);

  const createPlan = async () => {
    if (!form.name.trim() || !form.priceMXN) return;
    await apiFetch("/admin/plans", {
      method: "POST",
      body: {
        name: form.name.trim(),
        type: form.type,
        priceMXN: Number(form.priceMXN),
        monthlyListingLimit: form.monthlyListingLimit ? Number(form.monthlyListingLimit) : undefined,
        activeListingLimit: form.activeListingLimit ? Number(form.activeListingLimit) : undefined,
        monthlyImageLimit: form.monthlyImageLimit ? Number(form.monthlyImageLimit) : undefined,
        maxImagesPerListing: form.maxImagesPerListing ? Number(form.maxImagesPerListing) : undefined,
        eventLimit: form.eventLimit ? Number(form.eventLimit) : undefined,
      },
    });
    setForm({
      name: "",
      type: "SELLER",
      priceMXN: "",
      monthlyListingLimit: "",
      activeListingLimit: "",
      monthlyImageLimit: "",
      maxImagesPerListing: "",
      eventLimit: "",
    });
    await load();
  };

  const toggleActive = async (plan: PlanRow) => {
    await apiFetch(`/admin/plans/${plan.id}`, { method: "PATCH", body: { isActive: !plan.isActive } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planes"
        subtitle="Control de suscripciones y límites."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <div className="space-y-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {plan.name} · {plan.type}
                  </p>
                  <p className="text-xs text-slate-400">
                    ${plan.priceMXN} MXN • Límites: {plan.monthlyListingLimit ?? "—"} listados/mes
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 ${plan.isActive ? "bg-jade-500/20 text-jade-300" : "bg-red-500/20 text-red-200"}`}>
                    {plan.isActive ? "Activo" : "Pausado"}
                  </span>
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() => toggleActive(plan)}
                  >
                    {plan.isActive ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            ))}
            {!plans.length && <p className="text-sm text-slate-400">Sin planes.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Nuevo plan</p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Precio MXN"
              value={form.priceMXN}
              onChange={(e) => setForm({ ...form, priceMXN: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Límite mensual de listados"
              value={form.monthlyListingLimit}
              onChange={(e) => setForm({ ...form, monthlyListingLimit: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Límite activo"
              value={form.activeListingLimit}
              onChange={(e) => setForm({ ...form, activeListingLimit: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Imágenes mensuales"
              value={form.monthlyImageLimit}
              onChange={(e) => setForm({ ...form, monthlyImageLimit: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Imágenes por listado"
              value={form.maxImagesPerListing}
              onChange={(e) => setForm({ ...form, maxImagesPerListing: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Límite de eventos"
              value={form.eventLimit}
              onChange={(e) => setForm({ ...form, eventLimit: e.target.value })}
            />
            <button
              className="w-full rounded-2xl bg-jade-500 px-4 py-3 text-sm font-semibold text-ink-950"
              onClick={createPlan}
            >
              Crear plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
