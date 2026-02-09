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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_routes_1 = require("./modules/auth/auth.routes");
const moderation_routes_1 = require("./modules/moderation/moderation.routes");
const listings_routes_1 = require("./modules/listings/listings.routes");
const catalog_routes_1 = require("./modules/catalog/catalog.routes");
const stores_routes_1 = require("./modules/stores/stores.routes");
const auctions_routes_1 = require("./modules/auctions/auctions.routes");
const chat_routes_1 = require("./modules/chat/chat.routes");
const reviews_routes_1 = require("./modules/reviews/reviews.routes");
const media_routes_1 = require("./modules/media/media.routes");
const users_routes_1 = require("./modules/users/users.routes");
const plans_routes_1 = require("./modules/plans/plans.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const db_1 = require("./db");
const cron_1 = require("./cron");
const bootstrap_1 = require("./utils/bootstrap");
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
    app.get("/uploads/*", async (request, reply) => {
        const rel = request.params["*"];
        const baseDir = path_1.default.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
        const resolved = path_1.default.resolve(baseDir, rel);
        if (!resolved.startsWith(baseDir)) {
            return reply.code(403).send({ error: "Forbidden" });
        }
        if (!fs_1.default.existsSync(resolved)) {
            return reply.code(404).send({ error: "Not found" });
        }
        const ext = path_1.default.extname(resolved).toLowerCase();
        if (ext === ".webp")
            reply.type("image/webp");
        if (ext === ".jpg" || ext === ".jpeg")
            reply.type("image/jpeg");
        if (ext === ".png")
            reply.type("image/png");
        return reply.send(fs_1.default.createReadStream(resolved));
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
    await app.register(users_routes_1.userRoutes);
    await app.register(plans_routes_1.plansRoutes);
    await app.register(admin_routes_1.adminRoutes);
    const port = Number(process.env.PORT ?? 3000);
    const host = process.env.HOST ?? "0.0.0.0";
    app.addHook("onClose", async () => {
        await db_1.prisma.$disconnect();
    });
    await (0, bootstrap_1.ensureAdminOnStart)();
    await app.listen({ port, host });
    (0, cron_1.startCron)();
}
start().catch((err) => {
    app.log.error(err);
    process.exit(1);
});
