"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Save } from "lucide-react";

interface ProjectSettingsProps {
  organizationId: string;
  projectId: string;
  initialName: string;
}

export function ProjectSettingsClient({ organizationId, projectId, initialName }: ProjectSettingsProps) {
  const router = useRouter();
  
  // Edit State
  const [name, setName] = useState(initialName);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === initialName) {
      setIsEditing(false);
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update project");
      }

      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "x-organization-id": organizationId,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }

      router.push(`/organizations/${organizationId}/projects`);
      router.refresh();
    } catch (err: any) {
      setDeleteError(err.message);
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mt-8">
      {/* Edit Section */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-zinc-900 mb-4">Project Settings</h2>
        
        {editError && (
          <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
            {editError}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-700 mb-1">
              Project Name
            </label>
            <div className="flex gap-2">
              <input
                id="name"
                type="text"
                required
                disabled={!isEditing || editLoading}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 border border-zinc-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
              />
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
                >
                  Edit
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={editLoading || !name.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-lg overflow-hidden">
        <div className="p-4 bg-red-50 border-b border-red-200">
          <h3 className="text-sm font-medium text-red-800">Danger Zone</h3>
        </div>
        <div className="p-6 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-zinc-900">Delete Project</h4>
              <p className="text-sm text-zinc-500 mt-1">
                Permanently remove this project and all of its contents. This action cannot be undone.
              </p>
            </div>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors shrink-0 ml-4"
              >
                Delete Project
              </button>
            ) : (
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteLoading}
                  className="px-3 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirm Delete
                </button>
              </div>
            )}
          </div>
          
          {deleteError && (
            <div className="mt-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
              {deleteError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
