import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";

const navItems = [
  { label: "Dashboard", to: "/admin" },
  { label: "Usuarios", to: "/admin/users" },
  { label: "Listados", to: "/admin/listings" },
  { label: "Subastas", to: "/admin/auctions" },
  { label: "Ventas", to: "/admin/deals" },
  { label: "Reportes", to: "/admin/reports" },
  { label: "Chats", to: "/admin/chats" },
  { label: "TCG", to: "/admin/tcg" },
  { label: "Verificaciones", to: "/admin/verifications" },
  { label: "Pagos", to: "/admin/payments" },
  { label: "Planes", to: "/admin/plans" },
  { label: "Tiendas", to: "/admin/stores" },
  { label: "Eventos", to: "/admin/events" },
  { label: "Settings", to: "/admin/settings" },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-white/10 bg-ink-900/90 p-6 transition lg:static lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400/80">Control</p>
              <h1 className="text-xl font-semibold text-white">TCG Admin</h1>
            </div>
            <button
              className="lg:hidden rounded-full border border-white/10 p-2 text-sm"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-xl px-4 py-2 text-sm transition ${
                    isActive
                      ? "bg-jade-500/20 text-jade-400 shadow-glow-jade"
                      : "text-slate-300 hover:bg-white/5"
                  }`
                }
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
            <p className="font-medium text-white">Acceso seguro</p>
            <p className="mt-2 text-slate-400">
              Panel protegido. Todas las rutas requieren rol <span className="text-amber-300">ADMIN/MOD</span>.
            </p>
            <button
              className="mt-4 w-full rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white transition hover:border-jade-400/60 hover:text-jade-300"
              onClick={() => logout()}
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-ink-950/80 px-4 py-4 backdrop-blur lg:px-8">
            <button
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80 lg:hidden"
              onClick={() => setOpen(true)}
            >
              Menu
            </button>
            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
                <span className="h-2 w-2 rounded-full bg-jade-400"></span>
                Seguridad activa
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
                admin@tcg
              </div>
            </div>
          </header>

          <main className="px-4 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
