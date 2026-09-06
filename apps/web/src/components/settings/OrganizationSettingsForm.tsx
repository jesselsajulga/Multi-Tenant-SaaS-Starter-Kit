"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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
    </div>
  );
}
