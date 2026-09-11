"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, ShieldAlert, UserMinus } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.user.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleRemove = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this workspace?`)) return;
    
    setLoadingId(userId);
    setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${API_URL}/organizations/${organizationId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
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
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-100">
        <div>
          <CardTitle className="text-base font-semibold text-zinc-900">Active Members</CardTitle>
          <p className="text-xs text-zinc-500 mt-0.5">
            {members.length} {members.length === 1 ? "member" : "members"} with access to this workspace
          </p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-400" />
          <Input
            type="search"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-zinc-50/50"
          />
        </div>
      </CardHeader>
      
      {error && (
        <div className="p-4 border-b border-red-100 bg-red-50">
          <Alert variant="destructive" className="border-0 bg-transparent p-0">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <AlertDescription className="text-xs text-red-700">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                <th className="px-5 py-2.5">Member</th>
                <th className="px-5 py-2.5">Role</th>
                <th className="px-5 py-2.5">Status</th>
                <th className="px-5 py-2.5">Joined</th>
                {isOwner && <th className="px-5 py-2.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-sm">
              {filteredMembers.map((member) => {
                const isMemberOwner = member.role === "OWNER";
                return (
                  <tr key={member.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-zinc-100 text-[11px] font-medium text-zinc-700">
                            {member.user.email.substring(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-xs text-zinc-900 truncate max-w-[220px]">
                          {member.user.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge 
                        variant={isMemberOwner ? "default" : "secondary"}
                        className="text-[10px] font-medium tracking-wide py-0.5"
                      >
                        {member.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500 font-mono">
                      {new Date(member.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-right">
                        {!isMemberOwner ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(member.id, member.user.email)}
                            disabled={loadingId === member.id}
                            className="h-7 px-2 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="w-3.5 h-3.5 mr-1" />
                            {loadingId === member.id ? "Removing..." : "Remove"}
                          </Button>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 5 : 4} className="px-5 py-8 text-center text-xs text-zinc-500">
                    No members matching "{search}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
