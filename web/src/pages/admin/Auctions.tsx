import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const statusOptions = ["", "SCHEDULED", "LIVE", "ENDED", "CANCELED"] as const;

type AuctionRow = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  topAmount?: string | number | null;
  listing: { id: string; title: string; seller?: { profile?: { displayName?: string | null } | null } };
};

export function Auctions() {
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (status) params.set("status", status);
    const res = await apiFetch<{ data: AuctionRow[] }>(`/admin/auctions?${params.toString()}`);
    setAuctions(res.data);
  };

  useEffect(() => {
    load().catch(() => setAuctions([]));
  }, [status]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subastas"
        subtitle="Seguimiento de subastas activas y cierres."
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
          {auctions.map((auction) => (
            <div
              key={auction.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{auction.listing.title}</p>
                <p className="text-xs text-slate-400">
                  {auction.listing.seller?.profile?.displayName ?? "Vendedor"} • {auction.status}
                </p>
              </div>
              <div className="text-xs text-slate-300">
                <div>Inicio: {new Date(auction.startAt).toLocaleString()}</div>
                <div>Fin: {new Date(auction.endAt).toLocaleString()}</div>
                <div>Puja top: {auction.topAmount ?? "—"}</div>
              </div>
            </div>
          ))}
          {!auctions.length && <p className="text-sm text-slate-400">Sin subastas.</p>}
        </div>
      </div>
    </div>
  );
}
