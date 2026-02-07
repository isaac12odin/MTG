"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const zod_1 = require("zod");
const auth_routes_1 = require("./modules/auth/auth.routes");
const moderation_routes_1 = require("./modules/moderation/moderation.routes");
const listings_routes_1 = require("./modules/listings/listings.routes");
const catalog_routes_1 = require("./modules/catalog/catalog.routes");
const stores_routes_1 = require("./modules/stores/stores.routes");
const auctions_routes_1 = require("./modules/auctions/auctions.routes");
const chat_routes_1 = require("./modules/chat/chat.routes");
const reviews_routes_1 = require("./modules/reviews/reviews.routes");
const media_routes_1 = require("./modules/media/media.routes");
const db_1 = require("./db");
const cron_1 = require("./cron");
const app = (0, fastify_1.default)({
    logger: true,
    trustProxy: true,
});
async function start() {
    const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
    await app.register(helmet_1.default, { contentSecurityPolicy: false });
    await app.register(cors_1.default, {
        origin: [APP_ORIGIN],
        credentials: true,
    });
    await app.register(cookie_1.default, {
        secret: process.env.COOKIE_SECRET,
    });
    await app.register(multipart_1.default, {
        limits: {
            fileSize: Number(process.env.UPLOAD_MAX_MB ?? 6) * 1024 * 1024,
            files: 1,
        },
    });
    await app.register(websocket_1.default);
    await app.register(rate_limit_1.default, {
        max: 200,
        timeWindow: "10 minute",
    });
    app.setErrorHandler((err, _request, reply) => {
        if (err instanceof zod_1.ZodError) {
            return reply.code(400).send({ error: "Invalid request", details: err.issues });
        }
        app.log.error(err);
        return reply.code(500).send({ error: "Internal error" });
    });
    app.get("/health", async () => ({ ok: true }));
    await app.register(auth_routes_1.authRoutes, { prefix: "/auth" });
    await app.register(moderation_routes_1.moderationRoutes, { prefix: "/moderation" });
    await app.register(listings_routes_1.listingRoutes);
    await app.register(catalog_routes_1.catalogRoutes, { prefix: "/catalog" });
    await app.register(stores_routes_1.storeRoutes);
    await app.register(auctions_routes_1.auctionRoutes);
    await app.register(chat_routes_1.chatRoutes);
    await app.register(reviews_routes_1.reviewRoutes);
    await app.register(media_routes_1.mediaRoutes);
    const port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "0.0.0.0";
    app.addHook("onClose", async () => {
        await db_1.prisma.$disconnect();
    });
    await app.listen({ port, host });
    (0, cron_1.startCron)();
}
start().catch((err) => {
    app.log.error(err);
    process.exit(1);
});
