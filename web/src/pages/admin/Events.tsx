import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

const statusOptions = ["", "DRAFT", "PUBLISHED", "FULL", "CANCELED", "ENDED"] as const;

type EventRow = {
  id: string;
  title: string;
  status: string;
  startAt: string;
  capacity?: number | null;
  organizer?: { profile?: { displayName?: string | null } | null } | null;
};

export function Events() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("");

  const load = async () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", "50");
    if (status) params.set("status", status);
    const res = await apiFetch<{ data: EventRow[] }>(`/admin/events?${params.toString()}`);
    setEvents(res.data);
  };

  useEffect(() => {
    load().catch(() => setEvents([]));
  }, [status]);

  const updateStatus = async (id: string, next: string) => {
    await apiFetch(`/admin/events/${id}`, { method: "PATCH", body: { status: next } });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        subtitle="Calendario y cupos de torneos."
        action={
          <select
            className="rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s || "Todos"}
              </option>
            ))}
          </select>
        }
      />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
            >
              <div>
                <p className="text-sm font-semibold text-white">{event.title}</p>
                <p className="text-xs text-slate-400">
                  {event.organizer?.profile?.displayName ?? "Organizador"} • {new Date(event.startAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">{event.status}</span>
                {event.status !== "CANCELED" && (
                  <button
                    className="rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() => updateStatus(event.id, "CANCELED")}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
          {!events.length && <p className="text-sm text-slate-400">Sin eventos.</p>}
        </div>
      </div>
    </div>
  );
}
