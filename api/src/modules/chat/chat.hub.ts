import WebSocket from "ws";

type SocketInfo = {
  socket: WebSocket;
  joined: Set<string>;
};

type SocketSet = Set<SocketInfo>;

const userSockets = new Map<string, SocketSet>();
const socketInfo = new WeakMap<WebSocket, SocketInfo>();

function cleanupClosed(set: SocketSet) {
  for (const info of set) {
    if (info.socket.readyState !== WebSocket.OPEN) {
      set.delete(info);
    }
  }
}

function getInfo(socket: WebSocket): SocketInfo | undefined {
  return socketInfo.get(socket);
}

export const chatHub = {
  addSocket(userId: string, socket: WebSocket) {
    const set = userSockets.get(userId) ?? new Set<SocketInfo>();
    const info: SocketInfo = { socket, joined: new Set() };
    set.add(info);
    socketInfo.set(socket, info);
    userSockets.set(userId, set);
  },
  removeSocket(userId: string, socket: WebSocket) {
    const set = userSockets.get(userId);
    if (!set) return;
    const info = getInfo(socket);
    if (info) {
      set.delete(info);
    } else {
      for (const candidate of set) {
        if (candidate.socket === socket) {
          set.delete(candidate);
          break;
        }
      }
    }
    if (set.size === 0) {
      userSockets.delete(userId);
    }
  },
  markJoined(userId: string, socket: WebSocket, conversationId: string) {
    const set = userSockets.get(userId);
    if (!set) return;
    const info = getInfo(socket);
    if (info) {
      info.joined.add(conversationId);
      return;
    }
    for (const candidate of set) {
      if (candidate.socket === socket) {
        candidate.joined.add(conversationId);
        return;
      }
    }
  },
  hasActiveSocket(userId: string, conversationId?: string) {
    const set = userSockets.get(userId);
    if (!set) return false;
    cleanupClosed(set);
    if (!conversationId) return set.size > 0;
    for (const info of set) {
      if (info.socket.readyState === WebSocket.OPEN && info.joined.has(conversationId)) {
        return true;
      }
    }
    return false;
  },
  getActiveSnapshot() {
    const perUser = [];
    let totalConnections = 0;
    for (const [userId, set] of userSockets.entries()) {
      cleanupClosed(set);
      const connections = Array.from(set).filter((info) => info.socket.readyState === WebSocket.OPEN);
      if (connections.length === 0) continue;
      totalConnections += connections.length;
      const conversationIds = new Set<string>();
      for (const info of connections) {
        for (const id of info.joined) conversationIds.add(id);
      }
      perUser.push({
        userId,
        connections: connections.length,
        joinedConversations: conversationIds.size,
      });
    }
    return {
      totalConnections,
      users: perUser.length,
      perUser,
    };
  },
  broadcastToUsers(userIds: string[], payload: unknown) {
    const message = JSON.stringify(payload);
    for (const userId of userIds) {
      const set = userSockets.get(userId);
      if (!set) continue;
      cleanupClosed(set);
      for (const info of set) {
        if (info.socket.readyState === WebSocket.OPEN) {
          info.socket.send(message);
        }
      }
    }
  },
};
