import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/providers/AuthProvider";
import { PageHeader } from "../../components/ui/PageHeader";

type Conversation = {
  id: string;
  updatedAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
};

export function Messages() {
  const { accessToken } = useAuth();
  const [params] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("conversationId"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    apiFetch<{ data: Conversation[] }>("/conversations")
      .then((res) => setConversations(res.data))
      .catch(() => setConversations([]));
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

    socket.onopen = () => {
      if (selectedId) {
        socket.send(JSON.stringify({ type: "join", conversationId: selectedId }));
      }
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "message") {
          const msg = payload.data as Message;
          setMessages((prev) => (msg.conversationId === selectedId ? [...prev, msg] : prev));
        }
      } catch {
        // ignore
      }
    };

    return () => socket.close();
  }, [accessToken, selectedId]);

  const sendMessage = async () => {
    if (!selectedId || !text.trim()) return;
    const payload = { type: "message", conversationId: selectedId, text: text.trim() };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      await apiFetch(`/conversations/${selectedId}/messages`, { method: "POST", body: { text: text.trim() } });
    }
    setText("");
  };

  return (
    <div className="min-h-screen bg-ink-950 text-slate-200">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <PageHeader title="Mensajes" subtitle="Tus conversaciones con vendedores y compradores." />
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <div className="rounded-3xl border border-white/10 bg-ink-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Conversaciones</p>
            <div className="mt-3 space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-xs ${
                    conv.id === selectedId
                      ? "border-jade-500/50 bg-jade-500/10 text-jade-300"
                      : "border-white/10 bg-white/5 text-slate-300"
                  }`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="font-semibold text-white">{conv.id.slice(0, 8)}...</div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {new Date(conv.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
              {!conversations.length && (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-xs text-slate-400">
                  Sin conversaciones.
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-[60vh] flex-col rounded-3xl border border-white/10 bg-ink-900/60 p-6">
            <div className="border-b border-white/10 pb-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Chat</p>
              <h3 className="text-lg font-semibold text-white">
                {selectedId ? selectedId : "Selecciona una conversación"}
              </h3>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto py-6">
              {messages.map((msg) => (
                <div key={msg.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                    {msg.senderId.slice(0, 6)} • {new Date(msg.createdAt).toLocaleString()}
                  </div>
                  <div className="mt-2 text-sm text-slate-100">{msg.text}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="flex-1 rounded-2xl border border-white/10 bg-ink-950/60 px-4 py-3 text-sm text-white"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                />
                <button
                  className="rounded-2xl bg-jade-500 px-6 py-3 text-sm font-semibold text-ink-950"
                  onClick={sendMessage}
                  disabled={!selectedId}
                >
                  Enviar
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Los chats se eliminan automáticamente después de 30 días.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
