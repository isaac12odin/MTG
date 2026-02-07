import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch, apiUpload } from "../../lib/api";
import { useDebounce } from "../../lib/hooks/useDebounce";

type UserMe = {
  profile?: { displayName?: string | null; country?: string | null } | null;
  security?: { emailVerifiedAt?: string | null; manualVerifiedAt?: string | null } | null;
};

type Address = {
  id: string;
  label?: string | null;
  line1: string;
  city: string;
  state: string;
  country: string;
};

type Card = {
  id: string;
  name: string;
  gameId: string;
};

export function SellerDashboard() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [cardQuery, setCardQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [listingTitle, setListingTitle] = useState("");
  const [condition, setCondition] = useState("NM");
  const [price, setPrice] = useState("");
  const [addressId, setAddressId] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const debouncedQuery = useDebounce(cardQuery, 350);

  useEffect(() => {
    apiFetch<{ data: UserMe }>("/me").then((res) => setMe(res.data)).catch(() => setMe(null));
    apiFetch<{ data: Address[] }>("/me/addresses").then((res) => setAddresses(res.data)).catch(() => setAddresses([]));
  }, []);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setCards([]);
      return;
    }
    apiFetch<{ data: Card[] }>(`/catalog/cards?q=${encodeURIComponent(debouncedQuery)}&page=1&pageSize=10`)
      .then((res) => setCards(res.data))
      .catch(() => setCards([]));
  }, [debouncedQuery]);

  const canBid = Boolean(me?.security?.manualVerifiedAt);

  const selectCard = (card: Card) => {
    setSelectedCard(card);
    setListingTitle(card.name);
    setCards([]);
    setCardQuery(card.name);
  };

  const handleUpload = async (file: File) => {
    const res = await apiUpload("/media/upload?purpose=LISTING", file);
    setMediaIds((prev) => [...prev, res.assetId]);
    setImagePreviews((prev) => [...prev, URL.createObjectURL(file)]);
  };

  const handleCreateListing = async () => {
    if (!selectedCard) {
      setStatusMessage("Selecciona una carta primero.");
      return;
    }
    if (!addressId) {
      setStatusMessage("Selecciona una dirección de envío.");
      return;
    }
    const askPrice = price ? Number(price) : undefined;
    try {
      await apiFetch("/listings", {
        method: "POST",
        body: {
          type: "FIXED",
          title: listingTitle || selectedCard.name,
          condition,
          currency: "MXN",
          askPrice,
          paymentWindowHours: 48,
          shippingFromAddressId: addressId,
          items: [{ cardId: selectedCard.id, qty: 1 }],
          mediaAssetIds: mediaIds.length ? mediaIds : undefined,
        },
      });
      setStatusMessage("Listing creado con éxito.");
      setMediaIds([]);
      setImagePreviews([]);
      setPrice("");
    } catch (err) {
      setStatusMessage((err as Error).message || "Error al crear listing.");
    }
  };

  const requestVerification = async () => {
    try {
      await apiFetch("/me/verification-requests", {
        method: "POST",
        body: { method: "VIDEO_CALL", notes: verificationNotes || undefined },
      });
      setStatusMessage("Solicitud enviada. Un moderador te contactará.");
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const addressOptions = useMemo(
    () => addresses.map((addr) => ({ value: addr.id, label: `${addr.line1}, ${addr.city} ${addr.state}` })),
    [addresses]
  );

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PageHeader
          title="Panel del vendedor"
          subtitle="Publica cartas rápido, gestiona tus fotos y solicita verificación."
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Crear publicación</h3>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Buscar carta</label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                    value={cardQuery}
                    onChange={(e) => setCardQuery(e.target.value)}
                    placeholder="Nombre de carta"
                  />
                  {cards.length > 0 && (
                    <div className="mt-2 max-h-44 overflow-auto rounded-2xl border border-white/10 bg-ink-950/80">
                      {cards.map((card) => (
                        <button
                          key={card.id}
                          onClick={() => selectCard(card)}
                          className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5"
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Título</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                      value={listingTitle}
                      onChange={(e) => setListingTitle(e.target.value)}
                      placeholder="Título visible"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Condición</label>
                    <select
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                    >
                      {["NM", "LP", "MP", "HP", "DMG"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Precio</label>
                    <input
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="MXN"
                      type="number"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Dirección</label>
                    <select
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                      value={addressId}
                      onChange={(e) => setAddressId(e.target.value)}
                    >
                      <option value="">Selecciona dirección</option>
                      {addressOptions.map((addr) => (
                        <option key={addr.value} value={addr.value}>
                          {addr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Fotos</label>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/5 text-xs text-slate-400">
                      + Subir
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                      />
                    </label>
                    {imagePreviews.map((src, idx) => (
                      <img
                        key={src}
                        src={src}
                        alt={`preview-${idx}`}
                        className="h-24 w-24 rounded-2xl border border-white/10 object-cover"
                        loading="lazy"
                      />
                    ))}
                  </div>
                </div>

                {statusMessage && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                    {statusMessage}
                  </div>
                )}

                <button
                  className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
                  onClick={handleCreateListing}
                >
                  Crear publicación
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Estado de verificación</h3>
              <p className="mt-2 text-sm text-slate-400">
                {canBid ? "Verificado ✅" : "Aún no verificado. Solicita revisión para subastar."}
              </p>
              {!canBid && (
                <div className="mt-4 space-y-3">
                  <textarea
                    className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                    placeholder="Notas o disponibilidad para llamada..."
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                  />
                  <button
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-xs uppercase tracking-[0.3em] text-white/80"
                    onClick={requestVerification}
                  >
                    Solicitar verificación
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Tu perfil</h3>
              <p className="mt-2 text-sm text-slate-400">
                {me?.profile?.displayName ?? "Completa tu perfil en /me/profile"}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
