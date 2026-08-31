"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptInvitationClient({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "accept" | "reject") => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/invitations/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} invitation`);
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans text-zinc-900 p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold">Workspace Invitation</h1>
          <p className="mt-2 text-sm text-zinc-500">You have been invited to join an organization.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200 text-center">
            {error}
          </div>
        )}

        <div className="space-y-3 mt-8">
          <button
            onClick={() => handleAction("accept")}
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Accept Invitation"}
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={loading}
            className="w-full rounded-md bg-white border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}
