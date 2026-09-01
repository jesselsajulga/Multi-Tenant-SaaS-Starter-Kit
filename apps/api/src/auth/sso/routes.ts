import type { FastifyPluginAsync } from "fastify";
import { randomBytes, createHash } from "node:crypto";
import { getSsoProvider } from "./providers";
import { resolveIdentityToUser } from "./sso";
import { createSession } from "../session";
import { setSessionCookie } from "../cookie";

export const ssoRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: { provider: string };
  }>("/auth/sso/:provider", async (request, reply) => {
    const { provider } = request.params;
    const ssoProvider = getSsoProvider(provider);

    if (!ssoProvider) {
      return reply.status(404).send({ error: "Provider not supported" });
    }

    const state = randomBytes(32).toString("base64url");
    const pkceVerifier = randomBytes(32).toString("base64url");
    const pkceChallenge = createHash("sha256").update(pkceVerifier).digest("base64url");

    // Store state and verifier in an HttpOnly cookie to prevent CSRF
    const ssoState = JSON.stringify({ state, pkceVerifier, provider });
    reply.setCookie("sso_state", ssoState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });

    const url = await ssoProvider.getAuthorizationUrl(state, pkceChallenge);
    return reply.redirect(url);
  });

  app.get<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string; error?: string };
  }>("/auth/sso/:provider/callback", async (request, reply) => {
    const { provider } = request.params;
    const { code, state, error } = request.query;

    if (error) {
      return reply.status(400).send({ error });
    }

    if (!code || !state) {
      return reply.status(400).send({ error: "Missing code or state" });
    }

    const ssoProvider = getSsoProvider(provider);
    if (!ssoProvider) {
      return reply.status(404).send({ error: "Provider not supported" });
    }

    const ssoStateCookie = request.cookies.sso_state;
    if (!ssoStateCookie) {
      return reply.status(400).send({ error: "Missing or expired SSO state" });
    }

    let parsedState: { state: string; pkceVerifier: string; provider: string };
    try {
      parsedState = JSON.parse(ssoStateCookie);
    } catch (err) {
      return reply.status(400).send({ error: "Invalid SSO state format" });
    }

    if (parsedState.state !== state || parsedState.provider !== provider) {
      return reply.status(400).send({ error: "State mismatch / CSRF detected" });
    }

    // Clear the state cookie after successful validation
    reply.clearCookie("sso_state", { path: "/" });

    try {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:4000/auth/sso/${provider}/callback`;
      const profile = await ssoProvider.exchangeCode(code, redirectUri, parsedState.pkceVerifier);

      // Identity resolution logic (linking, creation)
      const user = await resolveIdentityToUser(profile, provider);

      // Issue standard local session, just like password login
      const { token } = await createSession(user.id);
      setSessionCookie(reply, token);

      // Redirect back to the frontend application
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return reply.redirect(`${frontendUrl}/organizations`);
    } catch (err: any) {
      app.log.error(err);
      if (err.message === "ACCOUNT_EXISTS_REQUIRES_LINKING") {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return reply.redirect(`${frontendUrl}/login?error=account_exists_requires_linking`);
      }
      return reply.status(500).send({ error: "SSO Exchange Failed" });
    }
  });
};
