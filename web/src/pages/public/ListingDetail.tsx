import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageHeader } from "../../components/ui/PageHeader";

type Listing = {
  id: string;
  sellerId: string;
  title: string;
  description?: string | null;
  condition?: string | null;
  language?: string | null;
  askPrice?: string | number | null;
  currency?: string | null;
  items?: { card: { name: string } }[];
  media?: { asset: { variants: { key: string; variant: string }[] } }[];
};

export function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ data: Listing }>(`/listings/${id}`)
      .then((res) => setListing(res.data))
      .catch((err) => setError((err as Error).message));
  }, [id]);

  const handleContact = async () => {
    if (!listing) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const res = await apiFetch<{ data: { id: string } }>("/conversations", {
      method: "POST",
      body: { userId: listing.sellerId },
    });
    navigate(`/messages?conversationId=${res.data.id}`);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-slate-300">
        <p>{error}</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 text-slate-400">Cargando...</div>
    );
  }

  const image = listing.media?.[0]?.asset?.variants?.[0]?.key;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-slate-200">
      <PageHeader title={listing.title} subtitle={listing.items?.[0]?.card?.name ?? ""} />
      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <div className="h-72 rounded-2xl border border-white/10 bg-white/5">
            {image && <img src={`/${image}`} alt={listing.title} className="h-full w-full rounded-2xl object-cover" />}
          </div>
          <div className="mt-4 text-sm text-slate-300">
            {listing.description ?? "Sin descripción."}
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Detalles</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Condición</span>
              <span>{listing.condition ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Idioma</span>
              <span>{listing.language ?? "—"}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold text-jade-300">
              <span>Precio</span>
              <span>
                {listing.askPrice ?? "—"} {listing.currency ?? "MXN"}
              </span>
            </div>
          </div>
          <button
            className="mt-6 w-full rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
            onClick={handleContact}
          >
            Contactar vendedor
          </button>
        </div>
      </div>
    </div>
  );
}
