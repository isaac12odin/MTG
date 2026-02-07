import "fastify";
import type { AccessTokenPayload } from "../security/jwt";

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}
