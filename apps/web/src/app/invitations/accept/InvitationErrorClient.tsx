"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvitationVerificationStatus } from "@/lib/invitations";

interface InvitationErrorClientProps {
  status: InvitationVerificationStatus;
  organizationName?: string;
  isAuthenticated: boolean;
}

export function InvitationErrorClient({
  status,
  organizationName,
  isAuthenticated,
}: InvitationErrorClientProps) {
  // Determine copy and title based on state
  let title = "Invitation unavailable";
  let description = "This invitation link is invalid or no longer available.";
  let showContactAdmin = false;

  switch (status) {
    case "REVOKED":
      title = "Invitation revoked";
      description =
        "This invitation was revoked by the workspace administrator and can no longer be used.";
      showContactAdmin = true;
      break;

    case "EXPIRED":
      title = "Invitation expired";
      description =
        "This invitation has expired and can no longer be used. Contact the workspace administrator to request a new invitation.";
      showContactAdmin = true;
      break;

    case "ACCEPTED":
      title = "Invitation already accepted";
      description =
        "This invitation has already been accepted. If you are a member of the workspace, sign in to continue.";
      break;

    case "REJECTED":
      title = "Invitation declined";
      description =
        "This invitation has already been declined and can no longer be used.";
      showContactAdmin = true;
      break;

    case "ERROR":
      title = "Unable to verify invitation";
      description =
        "A connection or server issue occurred while checking your invitation. Please try again or return home.";
      break;

    case "INVALID":
    default:
      title = "Invitation unavailable";
      description = "This invitation link is invalid or no longer available.";
      break;
  }

  const primaryCtaText = isAuthenticated ? "Go to my workspaces" : "Return home";
  const primaryCtaHref = isAuthenticated ? "/organizations" : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm text-center">
        {organizationName && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {organizationName}
          </div>
        )}

        <h1 className="text-2xl font-semibold text-zinc-900 mb-3">{title}</h1>

        <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
          {description}
        </p>

        {showContactAdmin && (
          <div className="mb-6 rounded-md bg-zinc-50 p-3 border border-zinc-100 text-xs text-zinc-500">
            Need access? Contact the workspace administrator to request a new invitation.
          </div>
        )}

        <div className="space-y-3">
          <Link href={primaryCtaHref} className="w-full block">
            <Button className="w-full">
              {primaryCtaText}
            </Button>
          </Link>

          {!isAuthenticated && status === "ACCEPTED" && (
            <Link href="/login" className="w-full block">
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
          )}

          {status === "ERROR" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
