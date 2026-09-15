"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, XCircle, MailCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface InvitationData {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviter: {
    email: string;
  };
}

interface InvitationsListProps {
  organizationId: string;
  invitations: InvitationData[];
  isOwner: boolean;
}

export function InvitationsList({ organizationId, invitations, isOwner }: InvitationsListProps) {
  const router = useRouter();
  const [pageError, setPageError] = useState<string | null>(null);

  // State for destructive revocation confirmation dialog
  const [confirmInvitation, setConfirmInvitation] = useState<{ id: string; email: string } | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isRevokeSuccess, setIsRevokeSuccess] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const handleOpenRevokeDialog = (id: string, email: string) => {
    setDialogError(null);
    setIsRevokeSuccess(false);
    setConfirmInvitation({ id, email });
  };

  const handleConfirmRevoke = async () => {
    if (!confirmInvitation || isRevoking || isRevokeSuccess) return;

    setIsRevoking(true);
    setDialogError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Match standard minimum loading duration from auth & invite flows so the spinner is clearly visible
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/organizations/${organizationId}/invitations/${confirmInvitation.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (!res.ok) {
        let errorMessage = "Unable to revoke this invitation. Please try again.";
        try {
          const data = await res.json();
          if (data.error) errorMessage = data.error;
        } catch {
          errorMessage = `Request failed with status ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      // Explicit success feedback within modal before auto-close
      setIsRevokeSuccess(true);

      setTimeout(() => {
        router.refresh();
        setConfirmInvitation(null);
        setIsRevokeSuccess(false);
      }, 2000);
    } catch (err: any) {
      // Keep modal open and display actionable error for retry
      setDialogError(err.message || "Unable to revoke this invitation. Please try again.");
    } finally {
      setIsRevoking(false);
    }
  };

  const pending = invitations.filter((inv) => inv.status === "PENDING");

  if (pending.length === 0) {
    return (
      <Card className="mt-8 bg-zinc-50/50 border-dashed">
        <CardContent className="p-8 text-center">
          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-2 text-zinc-400">
            <MailCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-semibold text-zinc-900 mb-0.5">No pending invitations</h3>
          <p className="text-xs text-zinc-500">There are no outstanding invitations for this workspace.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mt-8 overflow-hidden">
        <CardHeader className="pb-4 border-b border-zinc-100">
          <CardTitle className="text-base font-semibold text-zinc-900">Pending Invitations</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">
            {pending.length} pending {pending.length === 1 ? "invitation" : "invitations"} awaiting acceptance
          </p>
        </CardHeader>
        
        {pageError && (
          <div className="p-4 border-b border-red-100 bg-red-50">
            <Alert variant="destructive" className="border-0 bg-transparent p-0">
              <AlertDescription className="text-xs text-red-700">{pageError}</AlertDescription>
            </Alert>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-5 py-2.5">Invited Email</th>
                  <th className="px-5 py-2.5">Invited By</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Expires</th>
                  {isOwner && <th className="px-5 py-2.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-sm">
                {pending.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3 font-medium text-xs text-zinc-900">
                      {inv.email}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {inv.inviter?.email || "Workspace Owner"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Pending
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 font-mono">
                      {new Date(inv.expiresAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRevokeDialog(inv.id, inv.email)}
                          className="h-7 px-2 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          <span>Revoke</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmInvitation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmInvitation(null);
            setIsRevokeSuccess(false);
            setDialogError(null);
          }
        }}
        title="Revoke invitation?"
        description={
          confirmInvitation
            ? `Revoke the pending invitation sent to ${confirmInvitation.email}? The invitation link will no longer work, and they will not be able to join this workspace using this invitation.`
            : ""
        }
        confirmLabel="Revoke invitation"
        loadingLabel="Revoking invitation..."
        successLabel="Invitation revoked!"
        variant="destructive"
        isLoading={isRevoking}
        isSuccess={isRevokeSuccess}
        error={dialogError}
        onConfirm={handleConfirmRevoke}
        onCancel={() => {
          setConfirmInvitation(null);
          setIsRevokeSuccess(false);
          setDialogError(null);
        }}
      />
    </>
  );
}
