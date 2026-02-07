"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatHub = void 0;
const ws_1 = __importDefault(require("ws"));
const userSockets = new Map();
const socketInfo = new WeakMap();
function cleanupClosed(set) {
    for (const info of set) {
        if (info.socket.readyState !== ws_1.default.OPEN) {
            set.delete(info);
        }
    }
}
function getInfo(socket) {
    return socketInfo.get(socket);
}
exports.chatHub = {
    addSocket(userId, socket) {
        const set = userSockets.get(userId) ?? new Set();
        const info = { socket, joined: new Set() };
        set.add(info);
        socketInfo.set(socket, info);
        userSockets.set(userId, set);
    },
    removeSocket(userId, socket) {
        const set = userSockets.get(userId);
        if (!set)
            return;
        const info = getInfo(socket);
        if (info) {
            set.delete(info);
        }
        else {
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
    markJoined(userId, socket, conversationId) {
        const set = userSockets.get(userId);
        if (!set)
            return;
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
    hasActiveSocket(userId, conversationId) {
        const set = userSockets.get(userId);
        if (!set)
            return false;
        cleanupClosed(set);
        if (!conversationId)
            return set.size > 0;
        for (const info of set) {
            if (info.socket.readyState === ws_1.default.OPEN && info.joined.has(conversationId)) {
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
            const connections = Array.from(set).filter((info) => info.socket.readyState === ws_1.default.OPEN);
            if (connections.length === 0)
                continue;
            totalConnections += connections.length;
            const conversationIds = new Set();
            for (const info of connections) {
                for (const id of info.joined)
                    conversationIds.add(id);
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
    broadcastToUsers(userIds, payload) {
        const message = JSON.stringify(payload);
        for (const userId of userIds) {
            const set = userSockets.get(userId);
            if (!set)
                continue;
            cleanupClosed(set);
            for (const info of set) {
                if (info.socket.readyState === ws_1.default.OPEN) {
                    info.socket.send(message);
                }
            }
        }
    },
};
