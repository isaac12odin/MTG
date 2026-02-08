import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../lib/api";

export function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"register" | "verify">("register");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"BUYER" | "SELLER" | "STORE">("BUYER");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
  }, [step]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: { email, password, phone: phone || null, accountType },
      });
      setStep("verify");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/verify-email", { method: "POST", body: { email, code } });
      navigate("/login");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    try {
      await apiFetch("/auth/otp/resend", { method: "POST", body: { email } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-400/80">Registro</p>
        <h2 className="text-2xl font-semibold text-white">
          {step === "register" ? "Crea tu cuenta" : "Verifica tu correo"}
        </h2>
        <p className="text-sm text-slate-400">
          {step === "register"
            ? "Únete para comprar, vender o subastar cartas."
            : "Ingresa el código de 6 dígitos que te enviamos."}
        </p>
      </div>

      {step === "register" ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Email</label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Teléfono</label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Tipo de cuenta</label>
            <select
              className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white focus:border-jade-400 focus:outline-none"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as "BUYER" | "SELLER" | "STORE")}
            >
              <option value="BUYER">Comprador</option>
              <option value="SELLER">Vendedor</option>
              <option value="STORE">Tienda</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Puedes cambiar o ampliar permisos después desde tu perfil.
            </p>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Password</label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="mt-2 text-xs text-slate-500">Mínimo 8 caracteres.</p>
          </div>
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <button
            className="w-full rounded-2xl bg-jade-500 px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-jade-400 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
          <div className="text-center text-xs text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <a className="text-jade-300 hover:text-jade-200" href="/login">
              Inicia sesión
            </a>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Código</label>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-jade-400 focus:outline-none"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
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
            type="submit"
            disabled={loading}
          >
            {loading ? "Verificando..." : "Verificar correo"}
          </button>
          <button
            type="button"
            className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/80"
            onClick={resend}
            disabled={loading}
          >
            Reenviar código
          </button>
        </form>
      )}
    </div>
  );
}
