import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { PageHeader } from "../../components/ui/PageHeader";

type UserMe = {
  profile?: { displayName?: string | null; bio?: string | null; city?: string | null; country?: string | null } | null;
  counts?: { followers: number; following: number };
  security?: { emailVerifiedAt?: string | null; manualVerifiedAt?: string | null } | null;
};

type Address = {
  id: string;
  label?: string | null;
  line1: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
};

export function Account() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    bio: "",
    city: "",
    country: "MX",
  });
  const [addressForm, setAddressForm] = useState({
    line1: "",
    city: "",
    state: "",
    country: "MX",
    postalCode: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const [meRes, addrRes] = await Promise.all([
      apiFetch<{ data: UserMe }>("/me"),
      apiFetch<{ data: Address[] }>("/me/addresses"),
    ]);
    setMe(meRes.data);
    setAddresses(addrRes.data);
    setProfileForm({
      displayName: meRes.data.profile?.displayName ?? "",
      bio: meRes.data.profile?.bio ?? "",
      city: meRes.data.profile?.city ?? "",
      country: meRes.data.profile?.country ?? "MX",
    });
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const updateProfile = async () => {
    await apiFetch("/me/profile", { method: "PUT", body: profileForm });
    setMessage("Perfil actualizado.");
    await load();
  };

  const addAddress = async () => {
    await apiFetch("/me/addresses", { method: "POST", body: addressForm });
    setMessage("Dirección guardada.");
    setAddressForm({ line1: "", city: "", state: "", country: "MX", postalCode: "" });
    await load();
  };

  const setDefault = async (id: string) => {
    await apiFetch(`/me/addresses/${id}/default`, { method: "POST" });
    await load();
  };

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <PageHeader title="Mi cuenta" subtitle="Gestiona tu perfil, direcciones y seguidores." />

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
            <h3 className="text-lg font-semibold text-white">Perfil</h3>
            <div className="mt-4 space-y-4">
              <input
                className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                placeholder="Nombre visible"
                value={profileForm.displayName}
                onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })}
              />
              <textarea
                className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                placeholder="Bio"
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                  placeholder="Ciudad"
                  value={profileForm.city}
                  onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                />
                <input
                  className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                  placeholder="País"
                  value={profileForm.country}
                  onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                />
              </div>
              <button
                className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
                onClick={updateProfile}
              >
                Guardar perfil
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
            <h3 className="text-lg font-semibold text-white">Seguidores</h3>
            <p className="mt-2 text-sm text-slate-400">
              Seguidores: {me?.counts?.followers ?? 0} · Siguiendo: {me?.counts?.following ?? 0}
            </p>
            <p className="mt-4 text-xs text-slate-500">
              Próximamente: lista de seguidores y opciones para seguir usuarios.
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <h3 className="text-lg font-semibold text-white">Direcciones</h3>
          <div className="mt-4 grid gap-3">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{addr.line1}</p>
                  <p className="text-xs text-slate-400">
                    {addr.city}, {addr.state} {addr.country}
                  </p>
                </div>
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-xs"
                  onClick={() => setDefault(addr.id)}
                >
                  {addr.isDefault ? "Default" : "Hacer default"}
                </button>
              </div>
            ))}
            {!addresses.length && <p className="text-sm text-slate-400">No hay direcciones.</p>}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Calle"
              value={addressForm.line1}
              onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Ciudad"
              value={addressForm.city}
              onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="Estado"
              value={addressForm.state}
              onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
            />
            <input
              className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
              placeholder="CP"
              value={addressForm.postalCode}
              onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
            />
          </div>
          <button
            className="mt-4 rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
            onClick={addAddress}
          >
            Agregar dirección
          </button>
        </section>

        {message && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
