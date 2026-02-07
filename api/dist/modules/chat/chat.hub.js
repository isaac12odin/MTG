"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatHub = void 0;
const ws_1 = __importDefault(require("ws"));
const userSockets = new Map();
function cleanupClosed(set) {
    for (const socket of set) {
        if (socket.readyState !== ws_1.default.OPEN) {
            set.delete(socket);
        }
    }
}
exports.chatHub = {
    addSocket(userId, socket) {
        const set = userSockets.get(userId) ?? new Set();
        set.add(socket);
        userSockets.set(userId, set);
    },
    removeSocket(userId, socket) {
        const set = userSockets.get(userId);
        if (!set)
            return;
        set.delete(socket);
        if (set.size === 0) {
            userSockets.delete(userId);
        }
    },
    hasActiveSocket(userId) {
        const set = userSockets.get(userId);
        if (!set)
            return false;
        cleanupClosed(set);
        return set.size > 0;
    },
    broadcastToUsers(userIds, payload) {
        const message = JSON.stringify(payload);
        for (const userId of userIds) {
            const set = userSockets.get(userId);
            if (!set)
                continue;
            cleanupClosed(set);
            for (const socket of set) {
                if (socket.readyState === ws_1.default.OPEN) {
                    socket.send(message);
                }
            }
        }
    },
};
