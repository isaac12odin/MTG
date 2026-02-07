import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

type VerificationRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  method: string;
  notes?: string | null;
  createdAt: string;
  user: {
    id: string;
    profile?: { displayName?: string | null; country?: string | null } | null;
    roles: { role: string }[];
  };
};

export function Verifications() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [filter, setFilter] = useState("PENDING");

  const load = async () => {
    const res = await apiFetch<{ data: VerificationRequest[] }>(
      `/admin/verifications?status=${encodeURIComponent(filter)}&page=1&pageSize=50`
    );
    setRequests(res.data);
  };

  useEffect(() => {
    load().catch(() => setRequests([]));
  }, [filter]);

  const decide = async (id: string, status: "APPROVED" | "REJECTED") => {
    await apiFetch(`/admin/verifications/${id}/decision`, { method: "POST", body: { status } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificaciones"
        subtitle="Solicitudes de vendedores y comunidad."
        action={
          <div className="flex gap-2">
            {["PENDING", "APPROVED", "REJECTED"].map((status) => (
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
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">
                  {req.user.profile?.displayName ?? req.user.id.slice(0, 8)}
                </p>
                <p className="text-xs text-slate-400">
                  {req.method} • {new Date(req.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">{req.status}</span>
                {req.status === "PENDING" && (
                  <>
                    <button
                      className="rounded-full bg-jade-500 px-3 py-1 text-xs font-semibold text-ink-950"
                      onClick={() => decide(req.id, "APPROVED")}
                    >
                      Aprobar
                    </button>
                    <button
                      className="rounded-full border border-red-400/40 px-3 py-1 text-xs text-red-200"
                      onClick={() => decide(req.id, "REJECTED")}
                    >
                      Rechazar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!requests.length && <p className="text-sm text-slate-400">Sin solicitudes.</p>}
        </div>
      </div>
    </div>
  );
}
