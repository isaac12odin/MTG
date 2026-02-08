import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { apiFetch } from "../../lib/api";

type DashboardStats = {
  usersTotal: number;
  usersLast24h: number;
  listingsActive: number;
  listingsLast24h: number;
  auctionsLive: number;
  dealsCompletedWeek: number;
  messagesToday: number;
  reportsOpen: number;
  paymentsPending: number;
};

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    apiFetch<{ data: DashboardStats }>("/admin/dashboard")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Resumen general de tu marketplace. Datos protegidos solo para admin."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuarios totales" value={String(stats?.usersTotal ?? "—")} hint="+24h" />
        <StatCard label="Listados activos" value={String(stats?.listingsActive ?? "—")} hint="+24h" />
        <StatCard label="Subastas activas" value={String(stats?.auctionsLive ?? "—")} hint="En tiempo real" />
        <StatCard label="Ventas cerradas" value={String(stats?.dealsCompletedWeek ?? "—")} hint="Últimos 7 días" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6 shadow-2xl shadow-black/30">
          <h3 className="text-lg font-semibold text-white">Actividad reciente</h3>
          <p className="mt-2 text-sm text-slate-400">
            Usuarios nuevos, mensajes y reportes del último día.
          </p>
          <div className="mt-6 grid gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Nuevos registros en las últimas 24h: {stats?.usersLast24h ?? "—"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Mensajes enviados hoy: {stats?.messagesToday ?? "—"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Reportes abiertos: {stats?.reportsOpen ?? "—"}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              Pagos pendientes: {stats?.paymentsPending ?? "—"}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900/80 via-ink-900/50 to-jade-500/10 p-6 shadow-2xl shadow-black/30">
          <h3 className="text-lg font-semibold text-white">Estado de seguridad</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              Autenticación JWT + Refresh: activo
            </li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              WebSockets con heartbeat: activo
            </li>
            <li className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              Reputación agregada en SQL: activo
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
