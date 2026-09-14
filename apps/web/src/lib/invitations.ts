const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type InvitationVerificationStatus =
  | "PENDING"
  | "EXPIRED"
  | "REVOKED"
  | "ACCEPTED"
  | "REJECTED"
  | "INVALID"
  | "ERROR";

export interface InvitationVerificationResult {
  status: InvitationVerificationStatus;
  organizationName?: string;
  error?: string;
}

/**
 * Calls the public verification endpoint to inspect the invitation status.
 * Distinguishes genuine invitation states (PENDING, EXPIRED, REVOKED, ACCEPTED, REJECTED, INVALID)
 * from network/server infrastructure errors (ERROR).
 */
export async function verifyInvitation(token: string): Promise<InvitationVerificationResult> {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { status: "INVALID", error: "Missing or invalid invitation token." };
  }

  try {
    const res = await fetch(
      `${API_URL}/invitations/verify?token=${encodeURIComponent(token.trim())}`,
      {
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      const data = await res.json().catch(() => ({}));
      return {
        status: "INVALID",
        error: data.error || "Invitation not found or invalid.",
      };
    }

    if (res.status === 400) {
      return {
        status: "INVALID",
        error: "Invalid invitation token format.",
      };
    }

    if (!res.ok) {
      return {
        status: "ERROR",
        error: "Unable to verify invitation due to a server or network issue.",
      };
    }

    const data = await res.json();
    return {
      status: data.status,
      organizationName: data.organizationName,
    };
  } catch (err: any) {
    return {
      status: "ERROR",
      error: "Unable to connect to verification service.",
    };
  }
}
