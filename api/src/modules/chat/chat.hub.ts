import WebSocket from "ws";

type SocketSet = Set<WebSocket>;

const userSockets = new Map<string, SocketSet>();

function cleanupClosed(set: SocketSet) {
  for (const socket of set) {
    if (socket.readyState !== WebSocket.OPEN) {
      set.delete(socket);
    }
  }
}

export const chatHub = {
  addSocket(userId: string, socket: WebSocket) {
    const set = userSockets.get(userId) ?? new Set<WebSocket>();
    set.add(socket);
    userSockets.set(userId, set);
  },
  removeSocket(userId: string, socket: WebSocket) {
    const set = userSockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      userSockets.delete(userId);
    }
  },
  hasActiveSocket(userId: string) {
    const set = userSockets.get(userId);
    if (!set) return false;
    cleanupClosed(set);
    return set.size > 0;
  },
  broadcastToUsers(userIds: string[], payload: unknown) {
    const message = JSON.stringify(payload);
    for (const userId of userIds) {
      const set = userSockets.get(userId);
      if (!set) continue;
      cleanupClosed(set);
      for (const socket of set) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(message);
        }
      }
    }
  },
};
