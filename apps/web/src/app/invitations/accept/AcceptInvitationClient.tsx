"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvitationErrorClient } from "./InvitationErrorClient";
import { InvitationVerificationStatus } from "@/lib/invitations";
import { Button } from "@/components/ui/button";

interface AcceptInvitationClientProps {
  token: string;
  organizationName?: string;
  isAuthenticated: boolean;
}

export function AcceptInvitationClient({
  token,
  organizationName,
  isAuthenticated,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raceTerminalState, setRaceTerminalState] = useState<InvitationVerificationStatus | null>(null);

  const handleAction = async (action: "accept" | "reject") => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/invitations/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage = data.error || `Failed to ${action} invitation`;

        // If backend reports that invitation is expired, revoked, or no longer pending (race condition)
        if (res.status === 409) {
          if (errorMessage.toLowerCase().includes("expired")) {
            setRaceTerminalState("EXPIRED");
            return;
          }
          if (
            errorMessage.toLowerCase().includes("no longer pending") ||
            errorMessage.toLowerCase().includes("canceled") ||
            errorMessage.toLowerCase().includes("revoked")
          ) {
            setRaceTerminalState("REVOKED");
            return;
          }
        }

        if (res.status === 404) {
          setRaceTerminalState("INVALID");
          return;
        }

        throw new Error(errorMessage);
      }

      router.push("/organizations");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (raceTerminalState) {
    return (
      <InvitationErrorClient
        status={raceTerminalState}
        organizationName={organizationName}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          {organizationName && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {organizationName}
            </div>
          )}
          <h1 className="text-2xl font-semibold">Workspace Invitation</h1>
          <p className="mt-2 text-sm text-zinc-500">
            You have been invited to join {organizationName ? `"${organizationName}"` : "an organization"}.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200 text-center">
            {error}
          </div>
        )}

        <div className="space-y-3 mt-8">
          <Button
            onClick={() => handleAction("accept")}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Processing..." : "Accept Invitation"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Processing..." : "Decline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
