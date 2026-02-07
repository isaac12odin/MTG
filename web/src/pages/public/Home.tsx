import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Listing = {
  id: string;
  title: string;
  askPrice?: string | number | null;
  currency?: string;
  condition?: string | null;
};

const fallbackCards: Listing[] = [
  { id: "1", title: "Black Lotus (Proxy)", askPrice: "—", currency: "MXN", condition: "NM" },
  { id: "2", title: "Charizard Base Set", askPrice: "—", currency: "MXN", condition: "LP" },
  { id: "3", title: "Blue-Eyes White Dragon", askPrice: "—", currency: "MXN", condition: "MP" },
  { id: "4", title: "Luffy Gear 5", askPrice: "—", currency: "MXN", condition: "NM" },
];

export function Home() {
  const [listings, setListings] = useState<Listing[]>(fallbackCards);

  useEffect(() => {
    apiFetch<{ data: Listing[] }>("/listings?page=1&pageSize=8")
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setListings(res.data);
        }
      })
      .catch(() => {
        setListings(fallbackCards);
      });
  }, []);

  return (
    <div className="relative">
      <section className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="absolute -left-40 top-10 h-72 w-72 rounded-full bg-jade-500/10 blur-3xl"></div>
        <div className="absolute -right-32 top-0 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl"></div>

        <div className="relative space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.4em] text-amber-300/80">
            Mercado TCG
          </div>
          <h1 className="text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
            Tu marketplace para cartas, subastas y tiendas{" "}
            <span className="text-jade-300 text-glow">en tiempo real</span>.
          </h1>
          <p className="max-w-xl text-base text-slate-300 sm:text-lg">
            Compra, vende e intercambia MTG, Pokémon, Yu‑Gi‑Oh, One Piece y más. Reputación, verificación y
            transparencia sin tocar el dinero.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="flex-1 rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Buscar por carta, set o juego"
            />
            <button className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950">
              Buscar cartas
            </button>
            <button className="rounded-2xl border border-white/20 px-6 py-3 text-sm text-white/80">
              Explorar tiendas
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            {["Subastas en vivo", "Compras seguras", "Reputación verificada", "Catálogo normalizado"].map((item) => (
              <span key={item} className="rounded-full border border-white/10 px-4 py-2">
                {item}
              </span>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Usuarios activos", value: "—" },
              { label: "Cartas publicadas", value: "—" },
              { label: "Subastas hoy", value: "—" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-2xl p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative space-y-4">
          <div className="glass animate-float rounded-3xl p-5 shadow-2xl shadow-black/40">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Actividad ahora</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Nuevas publicaciones hoy: —
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Subastas activas: —
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Tiendas verificadas: —
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Vendedores verificados", desc: "Validación manual + comunidad." },
              { title: "Protección antifraude", desc: "Reportes y evidencias." },
            ].map((card) => (
              <div key={card.title} className="glass rounded-2xl p-4">
                <p className="text-sm font-semibold text-white">{card.title}</p>
                <p className="mt-2 text-xs text-slate-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="flex flex-wrap gap-3">
          {["MTG", "Pokémon", "Yu‑Gi‑Oh", "One Piece", "Digimon", "Lorcana"].map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="cartas" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-400/80">Cartas destacadas</p>
            <h2 className="text-2xl font-semibold text-white">Últimas publicaciones</h2>
          </div>
          <button className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70">
            Ver todo
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listings.map((card) => (
            <div
              key={card.id}
              className="group rounded-3xl border border-white/10 bg-ink-900/60 p-4 transition hover:-translate-y-1 hover:border-jade-400/50"
            >
              <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/40 via-ink-900/20 to-jade-500/10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,191,36,0.2),transparent_55%)]" />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-white">{card.title}</p>
                <p className="text-xs text-slate-400">Condición: {card.condition ?? "—"}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="rounded-full border border-white/10 px-2 py-1 text-slate-400">Single</span>
                  <span className="text-sm text-jade-300">
                    {card.askPrice ?? "—"} {card.currency ?? "MXN"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="subastas" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-ink-900/80 via-ink-900/40 to-amber-400/10 p-8">
            <h3 className="text-2xl font-semibold text-white">Subastas en tiempo real</h3>
            <p className="mt-3 text-sm text-slate-300">
              Puja con confianza. Cada vendedor pasa por verificación manual y reputación comunitaria.
            </p>
            <button className="mt-6 rounded-2xl bg-amber-400 px-6 py-3 text-sm font-semibold text-ink-950">
              Explorar subastas
            </button>
          </div>
          <div className="glass rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Cómo funciona</p>
            <ol className="mt-4 space-y-4 text-sm text-slate-300">
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                1. Encuentra una subasta y participa en tiempo real.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                2. Ganas la puja y coordinas pago fuera de plataforma.
              </li>
              <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                3. Confirma entrega y deja tu reseña.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section id="tiendas" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: "Tiendas verificadas", desc: "Perfiles completos, horarios y stock actualizado." },
            { title: "Inventario en vivo", desc: "Actualizaciones rápidas para prevenir sobreventa." },
            { title: "Eventos y torneos", desc: "Gestiona cupos y entradas desde la plataforma." },
          ].map((item) => (
            <div key={item.title} className="glass rounded-3xl p-6">
              <h4 className="text-lg font-semibold text-white">{item.title}</h4>
              <p className="mt-3 text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="torneos" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-ink-900/80 via-ink-900/50 to-jade-500/10 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-300/80">Torneos</p>
              <h3 className="text-2xl font-semibold text-white">Gestiona cupos y disponibilidad en minutos.</h3>
              <p className="mt-3 text-sm text-slate-300">
                Publica eventos, controla asistencia y conecta con jugadores cerca de ti.
              </p>
            </div>
            <button className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950">
              Publicar torneo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
