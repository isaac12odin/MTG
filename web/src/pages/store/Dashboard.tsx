import { PageHeader } from "../../components/ui/PageHeader";

export function StoreDashboard() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="Panel de tienda" subtitle="Inventario, eventos y gestión de pagos." />
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-8 text-sm text-slate-300">
          Próximamente: inventario, torneos, staff y reportes.
        </div>
      </div>
    </div>
  );
}
