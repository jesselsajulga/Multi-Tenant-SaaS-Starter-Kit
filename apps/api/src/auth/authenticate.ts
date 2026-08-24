import type { FastifyRequest } from "fastify";

import { SESSION_COOKIE_NAME } from "./cookie";
import { validateSessionToken } from "./session";

export async function authenticateRequest(
  request: FastifyRequest,
) {
  const token = request.cookies[SESSION_COOKIE_NAME];

  if (!token) {
    return null;
  }

  return validateSessionToken(token);
}
