"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = mediaRoutes;
const guards_1 = require("../../security/guards");
const media_controller_1 = require("./media.controller");
async function mediaRoutes(app) {
    app.post("/media/upload", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, media_controller_1.uploadMedia);
}
