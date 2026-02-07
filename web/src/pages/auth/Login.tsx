import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";

export function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const redirectByRole = (roles: string[]) => {
    if (roles.includes("ADMIN") || roles.includes("MOD")) return "/admin";
    if (roles.includes("STORE")) return "/store";
    if (roles.includes("SELLER")) return "/seller";
    return "/";
  };

  useEffect(() => {
    if (user?.roles?.length) {
      navigate(redirectByRole(user.roles), { replace: true });
    }
  }, [user, navigate]);

  return (
    <div>
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-400/80">Acceso</p>
        <h2 className="text-2xl font-semibold text-white">Inicia sesión</h2>
        <p className="text-sm text-slate-400">Accede a tu cuenta para comprar o vender.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@tuapp.com"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Password</label>
          <input
            className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
          />
        </div>
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <button
          className="w-full rounded-2xl bg-jade-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-jade-400 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Ingresando..." : "Entrar al panel"}
        </button>
        <div className="text-center text-xs text-slate-400">
          ¿No tienes cuenta?{" "}
          <a className="text-jade-300 hover:text-jade-200" href="/register">
            Crear cuenta
          </a>
        </div>
      </form>
    </div>
  );
}
