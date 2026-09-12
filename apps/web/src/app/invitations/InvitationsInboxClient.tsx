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

export function InvitationsInboxClient({
  initialInvitations,
}: {
  initialInvitations: ReceivedInvitation[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>(initialInvitations);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (invitation: ReceivedInvitation) => {
    setLoadingId(invitation.id);
    setError(null);
    try {
      await acceptReceivedInvitation(invitation.id);
      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
      router.push(`/organizations/${invitation.organization.id}/dashboard`);
    } catch (err: any) {
      setError(err.message);
      setLoadingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    setLoadingId(invitationId);
    setError(null);
    try {
      await declineReceivedInvitation(invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
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
            const isLoading = loadingId === invite.id;
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
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleDecline(invite.id)}
                    className="text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleAccept(invite)}
                    className="bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    {isLoading ? "Joining..." : "Accept Invitation"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
