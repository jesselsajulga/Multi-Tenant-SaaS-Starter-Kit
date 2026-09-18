"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { DeleteWorkspaceModal } from "./DeleteWorkspaceModal";

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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isOwner = role === "OWNER";

  const handleDeleteSuccess = async () => {
    setIsDeleteModalOpen(false);

    try {
      // Query remaining organizations for user
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations`, {
        credentials: "include",
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const remaining = (data.organizations || []).filter(
          (o: any) => o.organization.id !== organizationId
        );

        if (remaining.length > 0) {
          router.push(`/organizations/${remaining[0].organization.id}/dashboard`);
          router.refresh();
          return;
        }
      }
    } catch {
      // Fallback to /organizations
    }

    router.push("/organizations");
    router.refresh();
  };

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
        credentials: "include",
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
    <div className="space-y-6">
      {/* General Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-700">
                <AlertDescription>Organization updated successfully.</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="sm:w-1/3">
                <label htmlFor="orgName" className="block text-sm font-medium text-zinc-900 mb-1">
                  Organization name
                </label>
              </div>
              <div className="sm:w-2/3 flex gap-3">
                <Input
                  id="orgName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isOwner || loading}
                  className="flex-1"
                />
                {isOwner && (
                  <Button
                    type="submit"
                    disabled={loading || name.trim() === "" || name === initialName}
                    className="shrink-0"
                  >
                    {loading ? "Saving..." : "Save changes"}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-zinc-100">
              <div className="sm:w-1/3">
                <label className="block text-sm font-medium text-zinc-900 mb-1">
                  Organization ID
                </label>
              </div>
              <div className="sm:w-2/3">
                <Input
                  type="text"
                  value={organizationId}
                  readOnly
                  className="w-full bg-zinc-50 text-zinc-500 font-mono"
                />
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Access Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="sm:w-1/3">
              <label className="block text-sm font-medium text-zinc-900 mb-1">
                Your role
              </label>
            </div>
            <div className="sm:w-2/3">
              <Badge variant="secondary" className="font-medium">
                {role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Section (OWNER only) */}
      {isOwner && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-zinc-900">Delete workspace</h4>
                <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
                  Permanently delete this workspace and all of its projects, members, invitations, and associated data. This action cannot be undone.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <DeleteWorkspaceModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          organizationId={organizationId}
          organizationName={name}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
