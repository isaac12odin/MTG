import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

type Game = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "BANNED";
};

export function TCG() {
  const [games, setGames] = useState<Game[]>([]);
  const [q, setQ] = useState("");
  const [newGame, setNewGame] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await apiFetch<{ data: Game[] }>(`/admin/games${query}`);
    setGames(res.data);
  };

  useEffect(() => {
    load().catch(() => setGames([]));
  }, []);

  const handleCreate = async () => {
    if (!newGame.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/admin/games", {
        method: "POST",
        body: { name: newGame.trim() },
      });
      setNewGame("");
      await load();
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (game: Game) => {
    const next = game.status === "ACTIVE" ? "BANNED" : "ACTIVE";
    await apiFetch(`/admin/games/${game.id}`, { method: "PATCH", body: { status: next } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="TCG"
        subtitle="Administra los juegos disponibles y bloquea comunidades cuando sea necesario."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
              placeholder="Buscar TCG"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/80"
              onClick={load}
            >
              Filtrar
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,280px]">
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <div className="grid gap-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-white">{game.name}</p>
                  <p className="text-xs text-slate-400">{game.slug}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`rounded-full px-3 py-1 ${
                      game.status === "ACTIVE"
                        ? "bg-jade-500/20 text-jade-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {game.status}
                  </span>
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                    onClick={() => toggleStatus(game)}
                  >
                    {game.status === "ACTIVE" ? "Banear" : "Reactivar"}
                  </button>
                </div>
              </div>
            ))}
            {!games.length && <p className="text-sm text-slate-400">Sin juegos.</p>}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Nuevo TCG</p>
          <input
            className="mt-3 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
            placeholder="Nombre del juego"
            value={newGame}
            onChange={(e) => setNewGame(e.target.value)}
          />
          <button
            className="mt-4 w-full rounded-2xl bg-jade-500 px-4 py-3 text-sm font-semibold text-ink-950"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "Creando..." : "Agregar"}
          </button>
          <p className="mt-4 text-xs text-slate-400">
            Si baneas un TCG, ningún usuario podrá publicar cartas de ese juego.
          </p>
        </div>
      </div>
    </div>
  );
}
