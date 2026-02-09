import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

const VARIANT_ORDER = ["SMALL", "MEDIUM", "THUMB", "LARGE"] as const;

type MediaVariant = {
  variant: "THUMB" | "SMALL" | "MEDIUM" | "LARGE";
  key: string;
  width: number;
  height: number;
};

type Listing = {
  id: string;
  title: string;
  type: "FIXED" | "AUCTION" | "TRADE";
  askPrice?: string | number | null;
  currency?: string;
  condition?: string | null;
  createdAt?: string;
  items?: Array<{ card?: { name?: string | null } | null; qty?: number | null }>;
  media?: Array<{ asset?: { variants?: MediaVariant[] | null } | null }>;
};

type AuctionRow = {
  id: string;
  status: string;
  endAt: string;
  topAmount?: string | number | null;
  startPrice?: string | number | null;
  listing: Listing & { shippingFrom?: { city?: string | null; state?: string | null } | null };
};

type Game = {
  id: string;
  name: string;
};

const fallbackCards: Listing[] = [];

function pickVariant(variants?: MediaVariant[] | null) {
  if (!variants?.length) return null;
  for (const v of VARIANT_ORDER) {
    const match = variants.find((item) => item.variant === v);
    if (match) return match;
  }
  return variants[0];
}

function resolveImage(listing: Listing) {
  const media = listing.media?.[0]?.asset?.variants ?? [];
  const variant = pickVariant(media);
  if (!variant?.key) return null;
  const cleaned = variant.key.replace(/^\/?uploads\//, "");
  return `/uploads/${cleaned}`;
}

function formatPrice(price?: string | number | null, currency?: string) {
  if (price === null || price === undefined) return "—";
  if (typeof price === "string") return `${price} ${currency ?? "MXN"}`;
  return `${price.toLocaleString("es-MX")} ${currency ?? "MXN"}`;
}

export function Home() {
  const [listings, setListings] = useState<Listing[]>(fallbackCards);
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [gameId, setGameId] = useState("");
  const [type, setType] = useState<"" | "FIXED" | "TRADE">("");
  const [loading, setLoading] = useState(false);

  const loadBase = async () => {
    const [gamesRes, listingsRes, auctionsRes] = await Promise.all([
      apiFetch<{ data: Game[] }>("/catalog/games"),
      apiFetch<{ data: Listing[] }>("/listings?page=1&pageSize=18"),
      apiFetch<{ data: AuctionRow[] }>("/auctions?status=LIVE&page=1&pageSize=8"),
    ]);
    setGames(gamesRes.data ?? []);
    setListings(listingsRes.data ?? []);
    setAuctions(auctionsRes.data ?? []);
  };

  useEffect(() => {
    loadBase().catch(() => {
      setListings(fallbackCards);
      setAuctions([]);
      setGames([]);
    });
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "24");
    if (query.trim()) params.set("q", query.trim());
    if (gameId) params.set("gameId", gameId);
    if (type) params.set("type", type);
    try {
      const res = await apiFetch<{ data: Listing[] }>(`/listings?${params.toString()}`);
      setListings(res.data.length ? res.data : []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const fixedListings = useMemo(
    () => listings.filter((item) => item.type === "FIXED" || item.type === "TRADE"),
    [listings]
  );

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <header className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-amber-300/80">TCG Marketplace</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              Cartas reales, subastas en vivo y vendedores verificados
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Busca singles, lotes y subastas activas. Compra directo al vendedor con reputación y evidencia.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-ink-900/70 p-4 md:grid-cols-[1fr,200px,200px,160px]">
          <input
            className="rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
            placeholder="Buscar carta, set o vendedor"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
          >
            <option value="">Todos los TCG</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
            value={type}
            onChange={(e) => setType(e.target.value as "" | "FIXED" | "TRADE")}
          >
            <option value="">Tipo</option>
            <option value="FIXED">Venta fija</option>
            <option value="TRADE">Intercambio</option>
          </select>
          <button
            className="rounded-2xl bg-jade-500 px-4 py-3 text-sm font-semibold text-ink-950"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1fr,320px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Cartas recientes</h2>
            <a className="text-xs uppercase tracking-[0.2em] text-slate-400" href="/">
              Ver todo
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fixedListings.length ? (
              fixedListings.map((card) => {
                const imageUrl = resolveImage(card);
                return (
                  <a
                    key={card.id}
                    href={`/listing/${card.id}`}
                    className="rounded-3xl border border-white/10 bg-ink-900/60 p-4 transition hover:border-jade-400/50"
                  >
                    <div className="relative h-40 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {imageUrl ? (
                        <img src={imageUrl} alt={card.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-sm font-semibold text-white">{card.title}</p>
                      <p className="text-xs text-slate-400">Condición: {card.condition ?? "—"}</p>
                      <p className="text-lg font-semibold text-jade-300">
                        {formatPrice(card.askPrice, card.currency)}
                      </p>
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="col-span-full rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                No hay publicaciones todavía.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <h3 className="text-sm font-semibold text-white">Subastas en vivo</h3>
            <div className="mt-4 space-y-3">
              {auctions.length ? (
                auctions.map((auction) => (
                  <a
                    key={auction.id}
                    href={`/listing/${auction.listing.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <p className="text-sm font-semibold text-white">{auction.listing.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Puja actual: {formatPrice(auction.topAmount ?? auction.startPrice, auction.listing.currency)}
                    </p>
                    <p className="text-xs text-slate-500">Termina: {new Date(auction.endAt).toLocaleString()}</p>
                  </a>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sin subastas activas.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <h3 className="text-sm font-semibold text-white">Publica rápido</h3>
            <p className="mt-2 text-xs text-slate-400">
              Vende singles o subasta en minutos. Verificación manual y reputación.
            </p>
            <a
              className="mt-4 inline-flex rounded-2xl bg-jade-500 px-4 py-2 text-xs font-semibold text-ink-950"
              href="/seller"
            >
              Ir al panel vendedor
            </a>
          </div>
        </aside>
      </section>
    </div>
  );
}
