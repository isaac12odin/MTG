import type { FastifyInstance } from "fastify";
import { listCards, listGames, listSets } from "./catalog.controller";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/games", listGames);
  app.get("/sets", listSets);
  app.get("/cards", listCards);
}
