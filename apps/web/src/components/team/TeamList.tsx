"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface MemberData {
  id: string;
  role: string;
  createdAt: string;
  user: {
    email: string;
  };
}

interface TeamListProps {
  organizationId: string;
  members: MemberData[];
  isOwner: boolean;
}

export function TeamList({ organizationId, members, isOwner }: TeamListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    
    setLoadingId(userId);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center">
        <h3 className="font-semibold text-zinc-900">Active Members</h3>
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
              <th className="px-6 py-3 font-medium">User</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Joined</th>
              {isOwner && <th className="px-6 py-3 font-medium text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-zinc-50/50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 shrink-0">
                      {member.user.email.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="font-medium text-zinc-900">
                      {member.user.email}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-3 text-zinc-500">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                {isOwner && (
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={loadingId === member.id}
                      className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {loadingId === member.id ? "Removing..." : "Remove"}
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
