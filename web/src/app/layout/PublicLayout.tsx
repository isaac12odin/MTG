import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";

const navItems = [
  { label: "Cartas", to: "/#cartas" },
  { label: "Subastas", to: "/#subastas" },
  { label: "Tiendas", to: "/#tiendas" },
  { label: "Torneos", to: "/#torneos" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <div className="bg-grid">
        <div className="border-b border-white/5 bg-ink-950/70 text-[11px] text-slate-400">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2">
            <span className="tracking-[0.35em] uppercase">Marketplace TCG LATAM</span>
            <span className="hidden sm:inline">Compras seguras • Vendedores verificados</span>
          </div>
        </div>

        <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-jade-400/40 bg-jade-500/10 text-jade-300">
              TCG
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-amber-400/80">Marketplace</p>
              <p className="text-sm font-semibold">TCG Hub</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.to} className="transition hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <Link
                to="/account"
                className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-jade-400/60 hover:text-jade-300"
              >
                Mi cuenta
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-jade-400/60 hover:text-jade-300"
                >
                  Acceso
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 transition hover:border-amber-300/60 hover:text-amber-200"
                >
                  Crear cuenta
                </Link>
              </>
            )}
            <button className="rounded-full bg-jade-500 px-5 py-2 text-xs font-semibold text-ink-950 transition hover:bg-jade-400">
              Publicar carta
            </button>
          </div>

          <button
            className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 md:hidden"
            onClick={() => setOpen((prev) => !prev)}
          >
            Menu
          </button>
        </div>

        {open && (
          <div className="border-t border-white/10 bg-ink-900/90 px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              {navItems.map((item) => (
                <a key={item.label} href={item.to} className="transition hover:text-white">
                  {item.label}
                </a>
              ))}
              {user ? (
                <Link
                  to="/account"
                  className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80"
                >
                  Mi cuenta
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80"
                  >
                    Acceso
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80"
                  >
                    Crear cuenta
                  </Link>
                </>
              )}
              <button className="rounded-xl bg-jade-500 px-4 py-2 text-xs font-semibold text-ink-950">
                Publicar carta
              </button>
            </div>
          </div>
        )}
        </header>
      </div>

      <main>{children}</main>
    </div>
  );
}
