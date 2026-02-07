"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRoutes = reviewRoutes;
const guards_1 = require("../../security/guards");
const reviews_controller_1 = require("./reviews.controller");
async function reviewRoutes(app) {
    app.post("/reviews", { preHandler: guards_1.requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, reviews_controller_1.createReview);
    app.get("/users/:id/reviews", reviews_controller_1.listUserReviews);
    app.get("/users/:id/reputation", reviews_controller_1.getReputation);
}
