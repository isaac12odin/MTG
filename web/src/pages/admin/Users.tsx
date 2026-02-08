import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const roleOptions = ["", "ADMIN", "MOD", "STORE", "SELLER", "BUYER"] as const;

type UserRow = {
  id: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  profile?: { displayName?: string | null; country?: string | null } | null;
  security?: { manualVerifiedAt?: string | null } | null;
  counts?: { listings?: number; dealsAsSeller?: number; dealsAsBuyer?: number };
};

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("");
  const [active, setActive] = useState<"" | "true" | "false">("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    if (active) params.set("active", active);
    const res = await apiFetch<{ data: UserRow[] }>(`/admin/users?${params.toString()}`);
    setUsers(res.data);
  };

  useEffect(() => {
    load().catch(() => setUsers([]));
  }, []);

  const toggleActive = async (user: UserRow) => {
    await apiFetch(`/admin/users/${user.id}`, { method: "PATCH", body: { isActive: !user.isActive } });
    await load();
  };

  const toggleVerify = async (user: UserRow) => {
    const verified = Boolean(user.security?.manualVerifiedAt);
    await apiFetch(`/admin/users/${user.id}`, { method: "PATCH", body: { manualVerified: !verified } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Gestión de cuentas, roles y verificaciones manuales."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              placeholder="Buscar por nombre" 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r || "Todos"}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              value={active}
              onChange={(e) => setActive(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Bloqueados</option>
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
          {users.map((user) => {
            const verified = Boolean(user.security?.manualVerifiedAt);
            return (
              <div
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    {user.profile?.displayName ?? user.email}
                  </p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">Roles: {user.roles.join(", ") || "—"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-3 py-1 ${
                      user.isActive ? "bg-jade-500/20 text-jade-300" : "bg-red-500/20 text-red-200"
                    }`}
                  >
                    {user.isActive ? "Activo" : "Bloqueado"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 ${
                      verified ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-slate-300"
                    }`}
                  >
                    {verified ? "Verificado" : "Sin verif"}
                  </span>
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                    onClick={() => toggleActive(user)}
                  >
                    {user.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                    onClick={() => toggleVerify(user)}
                  >
                    {verified ? "Quitar verif" : "Verificar"}
                  </button>
                </div>
              </div>
            );
          })}
          {!users.length && <p className="text-sm text-slate-400">Sin usuarios.</p>}
        </div>
      </div>
    </div>
  );
}
