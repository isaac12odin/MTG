import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../components/ui/PageHeader";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/providers/AuthProvider";

type Conversation = {
  id: string;
  userAId: string;
  userBId: string;
  listingId?: string | null;
  updatedAt: string;
  userA?: { id: string; profile?: { displayName?: string | null } | null } | null;
  userB?: { id: string; profile?: { displayName?: string | null } | null } | null;
  messages?: { id: string; text: string; createdAt: string }[];
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

type ActiveUserRow = {
  userId: string;
  connections: number;
  joinedConversations: number;
  displayName?: string;
  roles?: string[];
};

type ChatStats = {
  totalConnections: number;
  users: number;
  perUser: ActiveUserRow[];
};

export function Chats() {
  const { accessToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [userIdToStart, setUserIdToStart] = useState("");
  const [stats, setStats] = useState<ChatStats | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conv) => conv.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const labelForConv = (conv: Conversation) => {
    const a = conv.userA?.profile?.displayName ?? conv.userAId.slice(0, 6);
    const b = conv.userB?.profile?.displayName ?? conv.userBId.slice(0, 6);
    return `${a} ↔ ${b}`;
  };

  useEffect(() => {
    apiFetch<{ data: Conversation[] }>("/conversations")
      .then((res) => setConversations(res.data))
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    apiFetch<{ data: ChatStats }>("/admin/chat/active-users")
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    apiFetch<{ data: Message[] }>(`/conversations/${selectedId}/messages?page=1&pageSize=50`)
      .then((res) => setMessages(res.data.slice().reverse()))
      .catch(() => setMessages([]));
  }, [selectedId]);

  useEffect(() => {
    if (!accessToken) return;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/ws/chat?token=${accessToken}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "message") {
          const msg = payload.data as Message;
          setMessages((prev) => (msg.conversationId === selectedId ? [...prev, msg] : prev));
          setConversations((prev) =>
            prev.map((conv) => (conv.id === msg.conversationId ? { ...conv, updatedAt: msg.createdAt } : conv))
          );
        }
      } catch {
        // ignore
      }
    };

    return () => {
      socket.close();
    };
  }, [accessToken, selectedId]);

  const handleSend = async () => {
    if (!selectedId || !text.trim()) return;
    const payload = { type: "message", conversationId: selectedId, text: text.trim() };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      await apiFetch(`/conversations/${selectedId}/messages`, {
        method: "POST",
        body: { text: text.trim() },
      });
    }
    setText("");
  };

  const handleStartConversation = async (targetId: string) => {
    if (!targetId.trim()) return;
    const res = await apiFetch<{ data: Conversation }>("/conversations", {
      method: "POST",
      body: { userId: targetId.trim() },
    });
    setConversations((prev) => [res.data, ...prev.filter((c) => c.id !== res.data.id)]);
    setSelectedId(res.data.id);
    setUserIdToStart("");
  };

  useEffect(() => {
    if (!selectedId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "join", conversationId: selectedId }));
  }, [selectedId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chats"
        subtitle="Interacción directa con usuarios y seguimiento de conversaciones."
        action={
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
            Conexiones activas: {stats?.totalConnections ?? "—"}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <div className="space-y-4 rounded-3xl border border-white/10 bg-ink-900/60 p-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Nuevo chat</label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2 text-xs text-white"
                placeholder="User ID"
                value={userIdToStart}
                onChange={(e) => setUserIdToStart(e.target.value)}
              />
              <button
                className="rounded-xl bg-jade-500 px-3 py-2 text-xs font-semibold text-ink-950"
                onClick={() => handleStartConversation(userIdToStart)}
              >
                Iniciar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Usuarios activos</p>
            <div className="space-y-2">
              {stats?.perUser?.length ? (
                stats.perUser.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{u.displayName ?? u.userId.slice(0, 6)}</p>
                      <p className="text-[11px] text-slate-400">
                        conexiones: {u.connections} • chats: {u.joinedConversations}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-white/20 px-3 py-1 text-[11px]"
                      onClick={() => handleStartConversation(u.userId)}
                    >
                      Abrir
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-xs text-slate-400">
                  Sin usuarios activos.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mis conversaciones</p>
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-xs transition ${
                    conv.id === selectedId
                      ? "border-jade-500/50 bg-jade-500/10 text-jade-300"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="font-semibold text-white">{labelForConv(conv)}</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(conv.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
              {!conversations.length && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-xs text-slate-400">
                  Sin conversaciones todavía.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-[60vh] flex-col rounded-3xl border border-white/10 bg-ink-900/60 p-6">
          <div className="border-b border-white/10 pb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Chat activo</p>
            <h3 className="text-lg font-semibold text-white">
              {selectedConversation ? labelForConv(selectedConversation) : "Selecciona una conversación"}
            </h3>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto py-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                  {msg.senderId.slice(0, 6)} • {new Date(msg.createdAt).toLocaleString()}
                </div>
                <div className="mt-2 text-sm text-slate-100">{msg.text}</div>
              </div>
            ))}
            {!messages.length && (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm text-slate-400">
                No hay mensajes en esta conversación.
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                className="flex-1 rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                placeholder="Escribe un mensaje..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
                onClick={handleSend}
                disabled={!selectedId}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
