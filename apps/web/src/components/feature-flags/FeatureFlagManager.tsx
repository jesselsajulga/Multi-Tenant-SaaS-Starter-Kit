"use client";

import React, { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Trash2, Plus, AlertCircle, Loader2 } from "lucide-react";

type FeatureFlag = {
  id: string;
  key: string;
  enabled: boolean;
  createdAt: string;
};

interface FeatureFlagManagerProps {
  organizationId: string;
  initialFlags: FeatureFlag[];
}

export function FeatureFlagManager({ organizationId, initialFlags }: FeatureFlagManagerProps) {
  const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
  const [newKey, setNewKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track operations by flag ID
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  
  // Confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    
    setIsCreating(true);
    setError(null);
    try {
      const res = await apiClient(`/organizations/${organizationId}/feature-flags`, {
        method: "POST",
        body: JSON.stringify({ key: newKey.trim(), enabled: false }),
      });
      
      if (res.error) throw new Error(res.error);
      
      setFlags([res, ...flags]);
      setNewKey("");
    } catch (err: any) {
      setError(err.message || "Failed to create feature flag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    setToggling((prev) => new Set(prev).add(flag.id));
    setError(null);
    try {
      const res = await apiClient(`/organizations/${organizationId}/feature-flags/${flag.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      
      if (res.error) throw new Error(res.error);
      
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f)));
    } catch (err: any) {
      setError(err.message || "Failed to update feature flag");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(flag.id);
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id));
    setError(null);
    try {
      const res = await apiClient(`/organizations/${organizationId}/feature-flags/${id}`, {
        method: "DELETE",
      });
      
      if (res.error) throw new Error(res.error);
      
      setFlags((prev) => prev.filter((f) => f.id !== id));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete feature flag");
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
        <form onSubmit={handleCreate} className="flex items-center gap-3 w-full max-w-md">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
            placeholder="e.g. NEW_BILLING_UI"
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={!newKey.trim() || isCreating}
            className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-zinc-900 border border-transparent rounded-md shadow-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[100px]"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" /> Add Flag</>}
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 bg-white">
              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Flag Key</th>
              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white">
            {flags.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-zinc-500">
                  <div className="flex flex-col items-center justify-center">
                    <p className="mb-2">No feature flags found.</p>
                    <p className="text-xs text-zinc-400">Create a flag above to start managing rollouts.</p>
                  </div>
                </td>
              </tr>
            ) : (
              flags.map((flag) => {
                const isToggling = toggling.has(flag.id);
                const isDeleting = deleting.has(flag.id);
                const isConfirmingDelete = confirmDeleteId === flag.id;

                return (
                  <tr key={flag.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-medium text-zinc-900">{flag.key}</div>
                      <div className="text-xs text-zinc-400 mt-1">
                        Created {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(flag.createdAt))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(flag)}
                        disabled={isToggling}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 ${
                          flag.enabled ? "bg-green-500" : "bg-zinc-200"
                        } disabled:opacity-50`}
                      >
                        <span className="sr-only">Toggle feature flag</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                            flag.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        >
                          {isToggling && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isConfirmingDelete ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-red-600 font-medium mr-2">Are you sure?</span>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(flag.id)}
                            disabled={isDeleting}
                            className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 flex items-center"
                          >
                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(flag.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete flag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
