import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import { uploadMedia } from "./media.controller";

export async function mediaRoutes(app: FastifyInstance) {
  app.post(
    "/media/upload",
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    uploadMedia
  );
}
