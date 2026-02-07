"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRoutes = chatRoutes;
const guards_1 = require("../../security/guards");
const chat_controller_1 = require("./chat.controller");
const chat_ws_1 = require("./chat.ws");
async function chatRoutes(app) {
    app.get("/conversations", { preHandler: guards_1.requireAuth }, chat_controller_1.listConversations);
    app.post("/conversations", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, chat_controller_1.createConversation);
    app.get("/conversations/:id/messages", { preHandler: guards_1.requireAuth }, chat_controller_1.listMessages);
    app.post("/conversations/:id/messages", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, chat_controller_1.sendMessage);
    await (0, chat_ws_1.registerChatWebsocket)(app);
}
