import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import { createReview, getReputation, listUserReviews } from "./reviews.controller";

export async function reviewRoutes(app: FastifyInstance) {
  app.post(
    "/reviews",
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    createReview
  );
  app.get("/users/:id/reviews", listUserReviews);
  app.get("/users/:id/reputation", getReputation);
}
