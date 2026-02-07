import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../security/guards";
import {
  createAddress,
  deleteAddress,
  followUser,
  getPublicProfile,
  getMe,
  listAddresses,
  listFollowers,
  listFollowing,
  requestVerification,
  setDefaultAddress,
  unfollowUser,
  updateAddress,
  upsertProfile,
} from "./users.controller";

export async function userRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: requireAuth }, getMe);
  app.put("/me/profile", { preHandler: requireAuth }, upsertProfile);

  app.get("/me/addresses", { preHandler: requireAuth }, listAddresses);
  app.post("/me/addresses", { preHandler: requireAuth }, createAddress);
  app.put("/me/addresses/:id", { preHandler: requireAuth }, updateAddress);
  app.delete("/me/addresses/:id", { preHandler: requireAuth }, deleteAddress);
  app.post("/me/addresses/:id/default", { preHandler: requireAuth }, setDefaultAddress);
  app.post("/me/verification-requests", { preHandler: requireAuth }, requestVerification);

  app.get("/users/:id", getPublicProfile);
  app.post("/users/:id/follow", { preHandler: requireAuth }, followUser);
  app.delete("/users/:id/follow", { preHandler: requireAuth }, unfollowUser);
  app.get("/users/:id/followers", listFollowers);
  app.get("/users/:id/following", listFollowing);
}
