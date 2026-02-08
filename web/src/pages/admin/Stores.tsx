import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

type StoreRow = {
  userId: string;
  storeName: string;
  contactPhone?: string | null;
  user: {
    id: string;
    profile?: { displayName?: string | null } | null;
    roles: { role: string }[];
    security?: { manualVerifiedAt?: string | null } | null;
  };
};

export function Stores() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (q.trim()) params.set("q", q.trim());
    const res = await apiFetch<{ data: StoreRow[] }>(`/admin/stores?${params.toString()}`);
    setStores(res.data);
  };

  useEffect(() => {
    load().catch(() => setStores([]));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiendas"
        subtitle="Perfiles de tienda, inventario y torneos."
        action={
          <div className="flex gap-2">
            <input
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              placeholder="Buscar tienda" 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80"
              onClick={load}
            >
              Filtrar
            </button>
          </div>
        }
      />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="space-y-3">
          {stores.map((store) => (
            <div
              key={store.userId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{store.storeName}</p>
                <p className="text-xs text-slate-400">
                  {store.user.profile?.displayName ?? store.user.id.slice(0, 6)} • {store.contactPhone ?? "—"}
                </p>
              </div>
              <div className="text-xs text-slate-300">
                Roles: {store.user.roles.map((r) => r.role).join(", ") || "—"}
              </div>
            </div>
          ))}
          {!stores.length && <p className="text-sm text-slate-400">Sin tiendas.</p>}
        </div>
      </div>
    </div>
  );
}
