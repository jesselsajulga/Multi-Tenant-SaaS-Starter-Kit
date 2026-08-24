import type { FastifyInstance } from "fastify";

import { hashPassword, verifyPassword } from "./password";
import { registerSchema, loginSchema } from "./schema";
import { createSession, invalidateSessionToken } from "./session";
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE_NAME } from "./cookie";
import { authenticateRequest } from "./authenticate";
import { prisma } from "../db";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid registration data",
      });
    }

    const { email, password } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return reply.status(409).send({
        error: "Email is already registered",
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.status(201).send({
      user,
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const result = loginSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid login data",
      });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return reply.status(401).send({
        error: "Invalid email or password",
      });
    }

    const passwordValid = await verifyPassword(
      password,
      user.passwordHash,
    );

    if (!passwordValid) {
      return reply.status(401).send({
        error: "Invalid email or password",
      });
    }

    const { token } = await createSession(user.id);

    setSessionCookie(reply, token);

    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  });

  app.get("/auth/me", async (request, reply) => {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return reply.status(401).send({
        error: "Unauthorized",
      });
    }

    const { user } = auth;

    return reply.status(200).send({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    
    if (token) {
      await invalidateSessionToken(token);
    }
    
    clearSessionCookie(reply);
    
    return reply.status(200).send({
      message: "Logged out successfully"
    });
  });
}
