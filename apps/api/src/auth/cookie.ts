import type { FastifyReply } from "fastify";

export const SESSION_COOKIE_NAME = "session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
): void {
  reply.setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.setCookie(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
