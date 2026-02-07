import { PageHeader } from "../../components/ui/PageHeader";

export function SellerDashboard() {
  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader
          title="Panel del vendedor"
          subtitle="Aquí podrás gestionar tus cartas, subastas y reputación."
        />
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-8 text-sm text-slate-300">
          Próximamente: publicaciones, subastas, mensajes y métricas.
        </div>
      </div>
    </div>
  );
}
