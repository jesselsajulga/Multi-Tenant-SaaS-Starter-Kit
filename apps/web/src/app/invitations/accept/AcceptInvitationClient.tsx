"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InvitationErrorClient } from "./InvitationErrorClient";
import { InvitationVerificationStatus } from "@/lib/invitations";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";
import { WelcomeWorkspaceModal } from "@/components/team/WelcomeWorkspaceModal";

interface AcceptInvitationClientProps {
  token: string;
  organizationName?: string;
  isAuthenticated: boolean;
}

export function AcceptInvitationClient({
  token,
  organizationName = "Workspace",
  isAuthenticated,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"accept" | "reject" | null>(null);
  const [successAction, setSuccessAction] = useState<"accept" | "reject" | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raceTerminalState, setRaceTerminalState] = useState<InvitationVerificationStatus | null>(null);

  const handleAction = async (action: "accept" | "reject") => {
    if (activeAction || successAction || showWelcomeModal) return;
    setActiveAction(action);
    setError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Match standard minimum loading duration from other flows so the spinner is clearly visible
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/invitations/${action}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

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

      if (action === "accept") {
        // Pause immediate route transition and trigger celebratory Welcome modal
        setActiveAction(null);
        setShowWelcomeModal(true);
      } else {
        // Decline: show confirmation then route to home
        setSuccessAction("reject");
        setActiveAction(null);
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
      setActiveAction(null);
    }
  };

  const handleNavigateToDashboard = () => {
    setShowWelcomeModal(false);
    router.push("/organizations");
    router.refresh();
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

  const isAccepting = activeAction === "accept";
  const isDeclining = activeAction === "reject";
  const isDeclineSuccess = successAction === "reject";
  const isBusy = activeAction !== null || successAction !== null || showWelcomeModal;

  return (
    <>
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
              disabled={isBusy}
              className="w-full"
            >
              {isAccepting ? (
                <>
                  <Spinner size="sm" className="mr-2 text-zinc-50" />
                  <span>Accepting...</span>
                </>
              ) : (
                "Accept Invitation"
              )}
            </Button>
            <Button
              variant={isDeclineSuccess ? "success" : "outline"}
              onClick={() => handleAction("reject")}
              disabled={isBusy}
              className={`w-full ${isDeclineSuccess ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100" : ""}`}
            >
              {isDeclineSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  <span>Invitation declined</span>
                </>
              ) : isDeclining ? (
                <>
                  <Spinner size="sm" className="mr-2 text-zinc-600" />
                  <span>Declining...</span>
                </>
              ) : (
                "Decline"
              )}
            </Button>
          </div>
        </div>
      </div>

      <WelcomeWorkspaceModal
        open={showWelcomeModal}
        organizationName={organizationName || "the workspace"}
        onConfirm={handleNavigateToDashboard}
      />
    </>
  );
}
