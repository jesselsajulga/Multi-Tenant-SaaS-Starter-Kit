import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_TTL_SECONDS * 1000,
  );

  const session = await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    token,
    session,
  };
}

export async function validateSessionToken(token: string) {
  const tokenHash = hashSessionToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  const { user, ...sessionData } = session;
  return { session: sessionData, user };
}

export async function invalidateSessionToken(token: string) {
  const tokenHash = hashSessionToken(token);
  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}
