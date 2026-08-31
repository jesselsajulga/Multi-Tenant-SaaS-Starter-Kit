"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center shadow-sm">
        <h3 className="text-zinc-900 font-medium mb-1">No pending invitations</h3>
        <p className="text-zinc-500 text-sm">There are no outstanding invitations for this workspace.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-zinc-200">
        <h3 className="font-semibold text-zinc-900">Pending Invitations</h3>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 text-sm border-b border-red-100">
          {error}
        </div>
      )}

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
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      disabled={loadingId === inv.id}
                      className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {loadingId === inv.id ? "Revoking..." : "Revoke"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
