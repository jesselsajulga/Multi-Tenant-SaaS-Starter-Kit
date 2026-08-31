import { prisma } from "../../db";
import type { IdentityProfile } from "./providers";

export async function resolveIdentityToUser(profile: IdentityProfile, providerName: string) {
  // 1. Check if identity already exists
  const existingIdentity = await prisma.identity.findUnique({
    where: {
      issuer_subject: {
        issuer: profile.issuer,
        subject: profile.subject
      }
    },
    include: {
      user: true
    }
  });

  if (existingIdentity) {
    return existingIdentity.user;
  }

  // 2. Check if the email is already in use by a local user or another identity
  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email }
  });

  if (existingUser) {
    // DO NOT SILENTLY LINK!
    // The user must explicitly authenticate to link the account.
    // We throw a specific error that the frontend/router can handle to redirect them to an account linking flow.
    throw new Error("ACCOUNT_EXISTS_REQUIRES_LINKING");
  }

  // 3. New User, New Identity
  const newUser = await prisma.user.create({
    data: {
      email: profile.email,
      passwordHash: null, // SSO-only user, no local password
      identities: {
        create: {
          provider: providerName,
          issuer: profile.issuer,
          subject: profile.subject
        }
      }
    }
  });

  return newUser;
}
