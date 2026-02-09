import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch, apiUpload } from "../../lib/api";
import { useDebounce } from "../../lib/hooks/useDebounce";

const listingTypes = ["FIXED", "AUCTION", "TRADE"] as const;

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
  isDefault?: boolean;
};

type Card = {
  id: string;
  name: string;
  gameId: string;
};

type Plan = {
  id: string;
  name: string;
  type: string;
  priceMXN: string;
  monthlyListingLimit?: number | null;
  activeListingLimit?: number | null;
  maxImagesPerListing?: number | null;
};

type PlanStatus = {
  active: { status: string; periodEnd: string; plan: Plan } | null;
  pending: { status: string; periodEnd: string; plan: Plan } | null;
};

type ListingRow = {
  id: string;
  title: string;
  status: string;
  type: string;
  askPrice?: string | number | null;
  currency?: string;
};

export function SellerDashboard() {
  const [me, setMe] = useState<UserMe | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [myListings, setMyListings] = useState<ListingRow[]>([]);
  const [cardQuery, setCardQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [listingType, setListingType] = useState<(typeof listingTypes)[number]>("FIXED");
  const [listingTitle, setListingTitle] = useState("");
  const [condition, setCondition] = useState("NM");
  const [price, setPrice] = useState("");
  const [addressId, setAddressId] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [auctionStart, setAuctionStart] = useState("");
  const [auctionEnd, setAuctionEnd] = useState("");
  const [startPrice, setStartPrice] = useState("");
  const [increment, setIncrement] = useState("10");
  const [reservePrice, setReservePrice] = useState("");
  const [buyNowPrice, setBuyNowPrice] = useState("");
  const [autoRelist, setAutoRelist] = useState(false);
  const [autoRelistHours, setAutoRelistHours] = useState("24");
  const [addressForm, setAddressForm] = useState({
    line1: "",
    city: "",
    state: "",
    country: "MX",
    postalCode: "",
  });

  const debouncedQuery = useDebounce(cardQuery, 350);

  const loadMine = async () => {
    const res = await apiFetch<{ data: ListingRow[] }>("/me/listings");
    setMyListings(res.data);
  };

  useEffect(() => {
    apiFetch<{ data: UserMe }>("/me").then((res) => setMe(res.data)).catch(() => setMe(null));
    apiFetch<{ data: Address[] }>("/me/addresses").then((res) => setAddresses(res.data)).catch(() => setAddresses([]));
    apiFetch<{ data: Plan[] }>("/plans").then((res) => setPlans(res.data)).catch(() => setPlans([]));
    apiFetch<{ data: PlanStatus }>("/me/plan").then((res) => setPlanStatus(res.data)).catch(() => setPlanStatus(null));
    loadMine().catch(() => setMyListings([]));
  }, []);

  useEffect(() => {
    if (!addressId && addresses.length) {
      const defaultAddr = addresses.find((addr) => addr.isDefault);
      setAddressId(defaultAddr?.id ?? addresses[0].id);
    }
  }, [addresses, addressId]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setCards([]);
      return;
    }
    apiFetch<{ data: Card[] }>(`/catalog/cards?q=${encodeURIComponent(debouncedQuery)}&page=1&pageSize=10`)
      .then((res) => setCards(res.data))
      .catch(() => setCards([]));
  }, [debouncedQuery]);

  const isVerified = Boolean(me?.security?.manualVerifiedAt);

  const selectCard = (card: Card) => {
    setSelectedCard(card);
    setListingTitle(card.name);
    setCards([]);
    setCardQuery(card.name);
  };

  const handleUpload = async (file: File) => {
    try {
      const res = await apiUpload("/media/upload?purpose=LISTING", file);
      setMediaIds((prev) => [...prev, res.assetId]);
      setImagePreviews((prev) => [...prev, URL.createObjectURL(file)]);
    } catch (err) {
      setStatusMessage((err as Error).message);
    }
  };

  const handleCreateListing = async () => {
    if (!selectedCard) {
      setStatusMessage("Selecciona una carta primero.");
      return;
    }
    if (!planStatus?.active) {
      setStatusMessage("Necesitas un plan activo para publicar. Solicítalo abajo.");
      return;
    }
    if (!addressId) {
      setStatusMessage("Selecciona una dirección de envío.");
      return;
    }

    const askPrice = price ? Number(price) : undefined;
    try {
      const listingRes = await apiFetch<{ data: { id: string } }>("/listings", {
        method: "POST",
        body: {
          type: listingType,
          title: listingTitle || selectedCard.name,
          condition,
          currency: "MXN",
          askPrice: listingType === "FIXED" || listingType === "TRADE" ? askPrice : undefined,
          paymentWindowHours: 48,
          shippingFromAddressId: addressId,
          items: [{ cardId: selectedCard.id, qty: 1 }],
          mediaAssetIds: mediaIds.length ? mediaIds : undefined,
        },
      });

      if (listingType === "AUCTION") {
        if (!startPrice || !increment) {
          setStatusMessage("Define precio inicial e incremento.");
          return;
        }
        const startAt = auctionStart ? new Date(auctionStart) : new Date();
        const endAt = auctionEnd ? new Date(auctionEnd) : new Date(Date.now() + 48 * 60 * 60 * 1000);
        await apiFetch("/auctions", {
          method: "POST",
          body: {
            listingId: listingRes.data.id,
            startAt,
            endAt,
            startPrice: Number(startPrice),
            increment: Number(increment),
            reservePrice: reservePrice ? Number(reservePrice) : undefined,
            buyNowPrice: buyNowPrice ? Number(buyNowPrice) : undefined,
            autoRelistOnUnpaid: autoRelist,
            autoRelistAfterHours: autoRelist ? Number(autoRelistHours) : undefined,
          },
        });
      }

      setStatusMessage("Publicación creada con éxito.");
      setMediaIds([]);
      setImagePreviews([]);
      setPrice("");
      setStartPrice("");
      setReservePrice("");
      setBuyNowPrice("");
      await loadMine();
    } catch (err) {
      setStatusMessage((err as Error).message || "Error al crear publicación.");
    }
  };

  const addAddress = async () => {
    if (!addressForm.line1 || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      setStatusMessage("Completa la dirección para guardar.");
      return;
    }
    await apiFetch("/me/addresses", { method: "POST", body: addressForm });
    setAddressForm({ line1: "", city: "", state: "", country: "MX", postalCode: "" });
    apiFetch<{ data: Address[] }>("/me/addresses").then((res) => setAddresses(res.data)).catch(() => setAddresses([]));
  };

  const subscribePlan = async (planId: string) => {
    setPlanMessage(null);
    try {
      await apiFetch("/plans/subscribe", { method: "POST", body: { planId } });
      setPlanMessage("Solicitud enviada. Espera la aprobación del admin.");
      const res = await apiFetch<{ data: PlanStatus }>("/me/plan");
      setPlanStatus(res.data);
    } catch (err) {
      setPlanMessage((err as Error).message);
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
          subtitle="Publica cartas, subastas o intercambios desde un solo lugar."
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Nueva publicación</h3>
              <div className="mt-4 grid gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Tipo</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                    value={listingType}
                    onChange={(e) => setListingType(e.target.value as any)}
                  >
                    {listingTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

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
                      {['NM', 'LP', 'MP', 'HP', 'DMG'].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(listingType === "FIXED" || listingType === "TRADE") && (
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
                )}

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
                  {!addresses.length && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
                      <p className="text-sm font-semibold text-white">Agrega una dirección de envío</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-2 text-xs text-white"
                          placeholder="Calle"
                          value={addressForm.line1}
                          onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                        />
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-2 text-xs text-white"
                          placeholder="Ciudad"
                          value={addressForm.city}
                          onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                        />
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-2 text-xs text-white"
                          placeholder="Estado"
                          value={addressForm.state}
                          onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                        />
                        <input
                          className="w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-2 text-xs text-white"
                          placeholder="CP"
                          value={addressForm.postalCode}
                          onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                        />
                      </div>
                      <button
                        className="mt-3 rounded-full border border-white/20 px-3 py-2 text-[11px] uppercase tracking-[0.2em]"
                        onClick={addAddress}
                      >
                        Guardar dirección
                      </button>
                    </div>
                  )}
                </div>

                {listingType === "AUCTION" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Inicio</label>
                      <input
                        type="datetime-local"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={auctionStart}
                        onChange={(e) => setAuctionStart(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Fin</label>
                      <input
                        type="datetime-local"
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={auctionEnd}
                        onChange={(e) => setAuctionEnd(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Precio inicial</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={startPrice}
                        onChange={(e) => setStartPrice(e.target.value)}
                        placeholder="MXN"
                        type="number"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Incremento</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={increment}
                        onChange={(e) => setIncrement(e.target.value)}
                        placeholder="MXN"
                        type="number"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Reserva</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={reservePrice}
                        onChange={(e) => setReservePrice(e.target.value)}
                        placeholder="Opcional"
                        type="number"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Buy Now</label>
                      <input
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                        value={buyNowPrice}
                        onChange={(e) => setBuyNowPrice(e.target.value)}
                        placeholder="Opcional"
                        type="number"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={autoRelist}
                        onChange={(e) => setAutoRelist(e.target.checked)}
                      />
                      Auto relistar si no pagan
                    </div>
                    {autoRelist && (
                      <div>
                        <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Horas para relistar</label>
                        <input
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                          value={autoRelistHours}
                          onChange={(e) => setAutoRelistHours(e.target.value)}
                          type="number"
                        />
                      </div>
                    )}
                  </div>
                )}

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
                  Publicar
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Mis publicaciones</h3>
              <div className="mt-4 space-y-3">
                {myListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{listing.title}</p>
                      <p className="text-xs text-slate-400">{listing.type} • {listing.status}</p>
                    </div>
                    <div className="text-xs text-jade-300">
                      {listing.askPrice ?? "—"} {listing.currency ?? "MXN"}
                    </div>
                  </div>
                ))}
                {!myListings.length && <p className="text-sm text-slate-400">Sin publicaciones.</p>}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Plan activo</h3>
              {planStatus?.active ? (
                <div className="mt-3 text-sm text-slate-300">
                  <p className="font-semibold text-white">{planStatus.active.plan.name}</p>
                  <p className="text-xs text-slate-400">
                    Vigente hasta {new Date(planStatus.active.periodEnd).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">No tienes un plan activo.</p>
              )}

              {planStatus?.pending && !planStatus.active && (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  Solicitud pendiente: {planStatus.pending.plan.name}. En revisión del admin.
                </div>
              )}

              {!planStatus?.active && (
                <div className="mt-4 space-y-3">
                  {plans.length ? (
                    plans.map((plan) => (
                      <div
                        key={plan.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{plan.name}</p>
                          <p className="text-xs text-slate-400">
                            ${plan.priceMXN} MXN · Límite mensual: {plan.monthlyListingLimit ?? "∞"}
                          </p>
                        </div>
                        <button
                          className="rounded-full bg-jade-500 px-3 py-1 text-xs font-semibold text-ink-950"
                          onClick={() => subscribePlan(plan.id)}
                        >
                          Solicitar
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No hay planes activos. Pídele al admin crear uno.</p>
                  )}
                </div>
              )}

              {planMessage && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                  {planMessage}
                </div>
              )}
            </section>
            <section className="rounded-3xl border border-white/10 bg-ink-900/60 p-6">
              <h3 className="text-lg font-semibold text-white">Estado de verificación</h3>
              <p className="mt-2 text-sm text-slate-400">
                {isVerified ? "Verificado ✅" : "Aún no verificado. Solicita revisión para subastar."}
              </p>
              {!isVerified && (
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
