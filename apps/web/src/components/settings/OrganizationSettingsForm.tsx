"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OrganizationSettingsFormProps {
  organizationId: string;
  initialName: string;
  role: string;
}

export function OrganizationSettingsForm({
  organizationId,
  initialName,
  role,
}: OrganizationSettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isOwner = role === "OWNER";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update organization");
      }

      setSuccess(true);
      router.refresh(); // Refresh to ensure server data is updated
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12">
      {/* General Settings Section */}
      <section>
        <h2 className="text-sm font-semibold tracking-wider text-zinc-500 uppercase mb-4">
          General
        </h2>
        <div className="border-t border-zinc-200">
          <form onSubmit={handleSubmit} className="py-6 space-y-6">
            
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm border border-red-200">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm border border-green-200">
                Organization updated successfully.
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <label htmlFor="orgName" className="block text-sm font-medium text-zinc-900 mb-1">
                  Organization name
                </label>
              </div>
              <div className="sm:w-2/3 flex gap-3">
                <input
                  id="orgName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isOwner || loading}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                {isOwner && (
                  <button
                    type="submit"
                    disabled={loading || name.trim() === "" || name === initialName}
                    className="bg-zinc-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {loading ? "Saving..." : "Save changes"}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-6 border-t border-zinc-100">
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-zinc-900 mb-1">
                  Organization ID
                </label>
              </div>
              <div className="sm:w-2/3">
                <input
                  type="text"
                  value={organizationId}
                  readOnly
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm bg-zinc-50 text-zinc-500 font-mono"
                />
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Access Settings Section */}
      <section>
        <h2 className="text-sm font-semibold tracking-wider text-zinc-500 uppercase mb-4">
          Access
        </h2>
        <div className="border-t border-zinc-200">
          <div className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-zinc-900 mb-1">
                  Your role
                </label>
              </div>
              <div className="sm:w-2/3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-zinc-100 text-zinc-800">
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
