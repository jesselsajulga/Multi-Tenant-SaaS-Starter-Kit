"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    
    setLoadingId(id);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/invitations/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to revoke invitation");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const pending = invitations.filter((inv) => inv.status === "PENDING");

  if (pending.length === 0) {
    return (
      <Card className="mt-8 bg-zinc-50 border-dashed">
        <CardContent className="p-8 text-center">
          <h3 className="text-zinc-900 font-medium mb-1">No pending invitations</h3>
          <p className="text-zinc-500 text-sm">There are no outstanding invitations for this workspace.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      
      {error && (
        <div className="px-6 pb-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Invited By</th>
                <th className="px-6 py-3 font-medium">Expires</th>
                {isOwner && <th className="px-6 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {pending.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-3 font-medium text-zinc-900">
                    {inv.email}
                  </td>
                  <td className="px-6 py-3 text-zinc-500">
                    {inv.inviter.email}
                  </td>
                  <td className="px-6 py-3 text-zinc-500">
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevoke(inv.id)}
                        disabled={loadingId === inv.id}
                        className="h-8"
                      >
                        {loadingId === inv.id ? "Revoking..." : "Revoke"}
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
  );
}
