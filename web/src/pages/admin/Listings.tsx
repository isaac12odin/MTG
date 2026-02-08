import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const statusOptions = ["", "ACTIVE", "DRAFT", "SOLD", "CLOSED", "REMOVED"] as const;
const typeOptions = ["", "FIXED", "AUCTION", "TRADE"] as const;

type ListingRow = {
  id: string;
  title: string;
  status: string;
  type: string;
  askPrice?: string | number | null;
  currency?: string;
  createdAt: string;
  seller?: { id: string; profile?: { displayName?: string | null } | null };
  items?: Array<{ card?: { name?: string | null; game?: { name?: string } | null } | null }>;
};

export function Listings() {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("");
  const [type, setType] = useState<(typeof typeOptions)[number]>("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (type) params.set("type", type);

    const res = await apiFetch<{ data: ListingRow[] }>(`/admin/listings?${params.toString()}`);
    setListings(res.data);
  };

  useEffect(() => {
    load().catch(() => setListings([]));
  }, []);

  const toggleStatus = async (listing: ListingRow) => {
    const next = listing.status === "REMOVED" ? "ACTIVE" : "REMOVED";
    await apiFetch(`/admin/listings/${listing.id}`, { method: "PATCH", body: { status: next } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listados"
        subtitle="Control de publicaciones y moderación."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              placeholder="Buscar" 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
            <select
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t || "Todo"}
                </option>
              ))}
            </select>
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
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{listing.title}</p>
                <p className="text-xs text-slate-400">
                  {listing.items?.[0]?.card?.game?.name ?? ""} {listing.items?.[0]?.card?.name ?? ""}
                </p>
                <p className="text-xs text-slate-500">
                  {listing.seller?.profile?.displayName ?? listing.seller?.id?.slice(0, 6)} • {listing.type}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">{listing.status}</span>
                <span className="text-jade-300">
                  {listing.askPrice ?? "—"} {listing.currency ?? "MXN"}
                </span>
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                  onClick={() => toggleStatus(listing)}
                >
                  {listing.status === "REMOVED" ? "Reactivar" : "Remover"}
                </button>
              </div>
            </div>
          ))}
          {!listings.length && <p className="text-sm text-slate-400">Sin listados.</p>}
        </div>
      </div>
    </div>
  );
}
