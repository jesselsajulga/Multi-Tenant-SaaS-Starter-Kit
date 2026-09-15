"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock, Building2, User, AlertCircle } from "lucide-react";
import {
  acceptReceivedInvitation,
  declineReceivedInvitation,
  type ReceivedInvitation,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { WelcomeWorkspaceModal } from "@/components/team/WelcomeWorkspaceModal";

export function InvitationsInboxClient({
  initialInvitations,
}: {
  initialInvitations: ReceivedInvitation[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>(initialInvitations);
  const [activeAction, setActiveAction] = useState<{ id: string; type: "accept" | "decline" } | null>(null);
  const [successAction, setSuccessAction] = useState<{ id: string; type: "accept" | "decline" } | null>(null);
  const [welcomeOrg, setWelcomeOrg] = useState<{ name: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (invitation: ReceivedInvitation) => {
    if (activeAction || successAction || welcomeOrg) return;
    setActiveAction({ id: invitation.id, type: "accept" });
    setError(null);

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));
      const acceptPromise = acceptReceivedInvitation(invitation.id);

      await Promise.all([acceptPromise, minDelay]);

      // Remove from list and open celebratory Welcome modal
      setActiveAction(null);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      setWelcomeOrg({ name: invitation.organization.name, id: invitation.organization.id });
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation");
      setActiveAction(null);
    }
  };

  const handleWelcomeConfirm = () => {
    if (!welcomeOrg) return;
    const orgId = welcomeOrg.id;
    setWelcomeOrg(null);
    router.push(`/organizations/${orgId}/dashboard`);
    router.refresh();
  };

  const handleDecline = async (invitationId: string) => {
    if (activeAction || successAction) return;
    setActiveAction({ id: invitationId, type: "decline" });
    setError(null);

    try {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));
      const declinePromise = declineReceivedInvitation(invitationId);

      await Promise.all([declinePromise, minDelay]);

      // Transition to explicit success state
      setSuccessAction({ id: invitationId, type: "decline" });
      setActiveAction(null);

      // Keep confirmation visible for 2 seconds before removing from list
      setTimeout(() => {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        setSuccessAction(null);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to decline invitation");
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {invitations.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 mb-4">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">No pending invitations</h2>
          <p className="mt-1 text-sm text-zinc-500 max-w-sm mx-auto">
            When another workspace invites your email to join, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invitations.map((invite) => {
            const isAccepting = activeAction?.id === invite.id && activeAction?.type === "accept";
            const isDeclining = activeAction?.id === invite.id && activeAction?.type === "decline";
            const isAcceptSuccess = successAction?.id === invite.id && successAction?.type === "accept";
            const isDeclineSuccess = successAction?.id === invite.id && successAction?.type === "decline";
            const isRowBusy = activeAction !== null || successAction !== null || welcomeOrg !== null;

            const formattedExpiry = new Date(invite.expiresAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={invite.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 font-semibold text-sm">
                      {invite.organization.name.substring(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3 className="font-semibold text-zinc-900">{invite.organization.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Invited by {invite.inviter.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500 pt-1">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {invite.role}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      Expires on {formattedExpiry}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0">
                  <Button
                    variant={isDeclineSuccess ? "success" : "outline"}
                    size="sm"
                    disabled={isRowBusy}
                    onClick={() => handleDecline(invite.id)}
                    className={
                      isDeclineSuccess
                        ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100"
                        : "text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                    }
                  >
                    {isDeclineSuccess ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        <span>Invitation declined</span>
                      </>
                    ) : isDeclining ? (
                      <>
                        <Spinner size="sm" className="mr-1.5 text-zinc-600" />
                        <span>Declining...</span>
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-1.5" />
                        <span>Decline</span>
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant={isAcceptSuccess ? "success" : "default"}
                    disabled={isRowBusy}
                    onClick={() => handleAccept(invite)}
                    className={
                      isAcceptSuccess
                        ? "!bg-green-600 hover:!bg-green-600 !text-white !opacity-100"
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    }
                  >
                    {isAcceptSuccess ? (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        <span>Invitation accepted!</span>
                      </>
                    ) : isAccepting ? (
                      <>
                        <Spinner size="sm" className="mr-1.5 text-zinc-50" />
                        <span>Accepting...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1.5" />
                        <span>Accept Invitation</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {welcomeOrg && (
        <WelcomeWorkspaceModal
          open={welcomeOrg !== null}
          organizationName={welcomeOrg.name}
          onConfirm={handleWelcomeConfirm}
        />
      )}
    </div>
  );
}
