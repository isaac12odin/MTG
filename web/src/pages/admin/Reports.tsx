import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const statusOptions = ["", "OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;

type ReportRow = {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter?: { profile?: { displayName?: string | null } | null } | null;
  targetUser?: { profile?: { displayName?: string | null } | null } | null;
  listing?: { title?: string | null } | null;
};

export function Reports() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (status) params.set("status", status);
    const res = await apiFetch<{ data: ReportRow[] }>(`/admin/reports?${params.toString()}`);
    setReports(res.data);
  };

  useEffect(() => {
    load().catch(() => setReports([]));
  }, [status]);

  const setReportStatus = async (id: string, next: string) => {
    await apiFetch(`/admin/reports/${id}`, { method: "PATCH", body: { status: next } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        subtitle="Fraudes, conflictos y sanciones."
        action={
          <select
            className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s || "Todos"}
              </option>
            ))}
          </select>
        }
      />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="space-y-3">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{rep.reason}</p>
                <p className="text-xs text-slate-400">
                  {rep.reporter?.profile?.displayName ?? "Usuario"} → {rep.targetUser?.profile?.displayName ?? "Objetivo"}
                </p>
                <p className="text-xs text-slate-500">{rep.listing?.title ?? "Sin listado"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">{rep.status}</span>
                {rep.status !== "RESOLVED" && (
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() => setReportStatus(rep.id, "RESOLVED")}
                  >
                    Resolver
                  </button>
                )}
                {rep.status !== "DISMISSED" && (
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() => setReportStatus(rep.id, "DISMISSED")}
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>
          ))}
          {!reports.length && <p className="text-sm text-slate-400">Sin reportes.</p>}
        </div>
      </div>
    </div>
  );
}
