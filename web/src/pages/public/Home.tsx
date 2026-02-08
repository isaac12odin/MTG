import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/providers/AuthProvider";

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
  sellerId?: string;
  items?: Array<{ card?: { name?: string | null } | null; qty?: number | null }>;
  media?: Array<{ asset?: { variants?: MediaVariant[] | null } | null }>;
  auction?: { endAt?: string | null; topAmount?: string | number | null } | null;
};

type Game = {
  id: string;
  name: string;
};

const fallbackCards: Listing[] = [
  { id: "1", title: "Black Lotus (Proxy)", type: "FIXED", askPrice: "—", currency: "MXN", condition: "NM" },
  { id: "2", title: "Charizard Base Set", type: "FIXED", askPrice: "—", currency: "MXN", condition: "LP" },
  { id: "3", title: "Blue-Eyes White Dragon", type: "AUCTION", askPrice: "—", currency: "MXN", condition: "MP" },
  { id: "4", title: "Luffy Gear 5", type: "TRADE", askPrice: "—", currency: "MXN", condition: "NM" },
];

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

function timeLabel(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-MX", { month: "short", day: "numeric" });
}

export function Home() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>(fallbackCards);
  const [games, setGames] = useState<Game[]>([]);
  const [query, setQuery] = useState("");
  const [gameId, setGameId] = useState("");
  const [type, setType] = useState<"" | "FIXED" | "AUCTION" | "TRADE">("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ data: Listing[] }>("/listings?page=1&pageSize=12")
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setListings(res.data);
        }
      })
      .catch(() => {
        setListings(fallbackCards);
      });

    apiFetch<{ data: Game[] }>("/catalog/games")
      .then((res) => setGames(res.data))
      .catch(() => setGames([]));
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "18");
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

  const auctions = useMemo(
    () => listings.filter((item) => item.type === "AUCTION").slice(0, 4),
    [listings]
  );

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 pb-6 pt-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-amber-300/80">Feed social TCG</p>
            <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
              {user ? "Hola, vuelve a comprar cartas" : "Compra, vende y subasta como comunidad"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Descubre publicaciones en tiempo real, sigue vendedores confiables y participa en subastas
              con evidencia y reputación.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-2xl border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80">
              Explorar tiendas
            </button>
            <button className="rounded-2xl bg-jade-500 px-5 py-2 text-xs font-semibold text-ink-950">
              Publicar carta
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-ink-900/70 p-4 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
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
            onChange={(e) => setType(e.target.value as "" | "FIXED" | "AUCTION" | "TRADE")}
          >
            <option value="">Todo</option>
            <option value="FIXED">Venta fija</option>
            <option value="AUCTION">Subastas</option>
            <option value="TRADE">Intercambio</option>
          </select>
          <button
            className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[240px,1fr,300px]">
        <aside className="order-2 space-y-6 lg:order-1">
          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Juegos</p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-slate-300">
              {games.length ? (
                games.slice(0, 10).map((g) => (
                  <button
                    key={g.id}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      gameId === g.id
                        ? "border-jade-400/70 bg-jade-500/10 text-jade-200"
                        : "border-white/10 bg-white/5 hover:border-jade-400/40"
                    }`}
                    onClick={() => setGameId(g.id)}
                  >
                    {g.name}
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sin juegos cargados.</p>
              )}
              <button
                className="rounded-xl border border-white/10 px-3 py-2 text-left text-xs text-slate-400"
                onClick={() => setGameId("")}
              >
                Limpiar filtro
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Acciones rápidas</p>
            <div className="mt-4 space-y-3 text-sm">
              <a className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3" href="/register">
                Verificación de vendedor
              </a>
              <a className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3" href="/messages">
                Ir a mensajes
              </a>
              <a className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3" href="/seller">
                Subir inventario
              </a>
            </div>
          </div>
        </aside>

        <main className="order-1 space-y-6 lg:order-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.4em] text-amber-400/80">Feed</p>
            <span className="text-xs text-slate-400">
              {listings.length} publicaciones
            </span>
          </div>

          <div className="space-y-4">
            {listings.length ? (
              listings.map((card) => {
                const imageUrl = resolveImage(card);
                return (
                  <article
                    key={card.id}
                    className="rounded-3xl border border-white/10 bg-ink-900/60 p-4 transition hover:border-jade-400/40"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900 via-ink-900/40 to-jade-500/10 sm:h-36 sm:w-48">
                        {imageUrl ? (
                          <img src={imageUrl} alt={card.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="rounded-full border border-white/10 px-3 py-1">
                            {card.type === "FIXED" && "Venta fija"}
                            {card.type === "AUCTION" && "Subasta"}
                            {card.type === "TRADE" && "Intercambio"}
                          </span>
                          {card.condition && (
                            <span className="rounded-full border border-white/10 px-3 py-1">{card.condition}</span>
                          )}
                          {card.createdAt && <span>• {timeLabel(card.createdAt)}</span>}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                        <p className="text-xs text-slate-400">
                          {card.items?.[0]?.card?.name ? `Carta: ${card.items[0].card?.name}` : "Publicación reciente"}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">Precio / Puja</p>
                            <p className="text-lg font-semibold text-jade-300">
                              {formatPrice(card.askPrice, card.currency)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={`/listing/${card.id}`}
                              className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80"
                            >
                              Ver detalle
                            </a>
                            <a
                              href={`/listing/${card.id}`}
                              className="rounded-full bg-jade-500 px-4 py-2 text-xs font-semibold text-ink-950"
                            >
                              {card.type === "AUCTION" ? "Pujar" : "Contactar"}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                No encontramos cartas con esos filtros.
              </div>
            )}
          </div>
        </main>

        <aside className="order-3 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Subastas activas</p>
            <div className="mt-4 space-y-3 text-sm">
              {auctions.length ? (
                auctions.map((auction) => (
                  <a
                    key={auction.id}
                    href={`/listing/${auction.id}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-white">{auction.title}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Termina: {auction.auction?.endAt ? timeLabel(auction.auction.endAt) : "—"}
                    </p>
                  </a>
                ))
              ) : (
                <p className="text-xs text-slate-500">Sin subastas por ahora.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Estadísticas</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Cartas hoy", value: "—" },
                { label: "Vendedores activos", value: "—" },
                { label: "Tratos completados", value: "—" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs text-slate-400">{stat.label}</p>
                  <p className="text-lg font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
