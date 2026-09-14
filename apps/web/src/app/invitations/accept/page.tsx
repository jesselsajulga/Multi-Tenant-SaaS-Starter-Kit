import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { verifyInvitation } from "@/lib/invitations";
import { AcceptInvitationClient } from "./AcceptInvitationClient";
import { InvitationErrorClient } from "./InvitationErrorClient";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;
  const session = await getServerSession();
  const isAuthenticated = !!session;

  if (!token || typeof token !== "string" || !token.trim()) {
    return (
      <InvitationErrorClient
        status="INVALID"
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // 1. Verify invitation status via the public endpoint
  const verification = await verifyInvitation(token);

  // 2. Handle terminal / error states directly without forcing login
  if (verification.status !== "PENDING") {
    return (
      <InvitationErrorClient
        status={verification.status}
        organizationName={verification.organizationName}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  // 3. If PENDING and user is unauthenticated, redirect to login while preserving the invitation link
  if (!session) {
    const returnTo = `/invitations/accept?token=${encodeURIComponent(token)}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // 4. Authenticated and pending: render the client acceptance component
  return (
    <AcceptInvitationClient
      token={token}
      organizationName={verification.organizationName}
      isAuthenticated={isAuthenticated}
    />
  );
}
