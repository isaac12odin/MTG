import { useEffect, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";

type SettingsData = {
  jobsEnabled: boolean;
  messageTtlDays: number;
  uploadMaxMb: number;
  uploadTtlHours: number;
  refreshDays: number;
};

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);

  useEffect(() => {
    apiFetch<{ data: SettingsData }>("/admin/settings")
      .then((res) => setSettings(res.data))
      .catch(() => setSettings(null));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Parámetros activos del backend." />

      <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            Jobs activos: {settings?.jobsEnabled ? "Sí" : "No"}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            TTL mensajes: {settings?.messageTtlDays ?? "—"} días
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            Upload máx: {settings?.uploadMaxMb ?? "—"} MB
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            TTL uploads: {settings?.uploadTtlHours ?? "—"} hrs
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            Refresh token: {settings?.refreshDays ?? "—"} días
          </div>
        </div>
      </div>
    </div>
  );
}
