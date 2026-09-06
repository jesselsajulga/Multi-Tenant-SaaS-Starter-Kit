"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Active Members</CardTitle>
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
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-zinc-200 text-xs font-medium text-zinc-700">
                          {member.user.email.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-zinc-900">
                        {member.user.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant="secondary">
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-zinc-500">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  {isOwner && (
                    <td className="px-6 py-3 text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemove(member.id)}
                        disabled={loadingId === member.id}
                        className="h-8"
                      >
                        {loadingId === member.id ? "Removing..." : "Remove"}
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
