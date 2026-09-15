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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface MemberData {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    email: string;
  };
}

interface TeamListProps {
  organizationId: string;
  organizationName?: string;
  members: MemberData[];
  isOwner: boolean;
}

export function TeamList({ organizationId, organizationName = "this workspace", members, isOwner }: TeamListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  // State for destructive removal confirmation dialog
  const [confirmMember, setConfirmMember] = useState<{ userId: string; email: string } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isRemoveSuccess, setIsRemoveSuccess] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) => m.user.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleOpenRemoveDialog = (userId: string, email: string) => {
    setDialogError(null);
    setIsRemoveSuccess(false);
    setConfirmMember({ userId, email });
  };

  const handleConfirmRemove = async () => {
    if (!confirmMember || isRemoving || isRemoveSuccess) return;

    setIsRemoving(true);
    setDialogError(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Match standard minimum loading duration from auth & invite flows so the spinner is clearly visible
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));

      const fetchPromise = fetch(`${API_URL}/organizations/${organizationId}/members/${confirmMember.userId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const [res] = await Promise.all([fetchPromise, minDelay]);

      if (!res.ok) {
        let errorMessage = "Unable to remove this member. Please try again.";
        try {
          const data = await res.json();
          if (data.error) errorMessage = data.error;
        } catch {
          errorMessage = `Request failed with status ${res.status}`;
        }
        throw new Error(errorMessage);
      }

      // Explicit success feedback within modal before auto-close
      setIsRemoveSuccess(true);

      setTimeout(() => {
        router.refresh();
        setConfirmMember(null);
        setIsRemoveSuccess(false);
      }, 2000);
    } catch (err: any) {
      // Keep modal open and display actionable error for retry
      setDialogError(err.message || "Unable to remove this member. Please try again.");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
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
        
        {pageError && (
          <div className="p-4 border-b border-red-100 bg-red-50">
            <Alert variant="destructive" className="border-0 bg-transparent p-0">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <AlertDescription className="text-xs text-red-700">{pageError}</AlertDescription>
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
                              onClick={() => handleOpenRemoveDialog(member.userId || member.id, member.user.email)}
                              className="h-7 px-2 text-xs text-zinc-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <UserMinus className="w-3.5 h-3.5 mr-1" />
                              Remove
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

      <ConfirmDialog
        open={confirmMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmMember(null);
            setIsRemoveSuccess(false);
            setDialogError(null);
          }
        }}
        title="Remove member?"
        description={
          confirmMember
            ? `Remove ${confirmMember.email} from ${organizationName}? They will immediately lose access to this workspace and its resources.`
            : ""
        }
        confirmLabel="Remove member"
        loadingLabel="Removing member..."
        successLabel="Member removed!"
        variant="destructive"
        isLoading={isRemoving}
        isSuccess={isRemoveSuccess}
        error={dialogError}
        onConfirm={handleConfirmRemove}
        onCancel={() => {
          setConfirmMember(null);
          setIsRemoveSuccess(false);
          setDialogError(null);
        }}
      />
    </>
  );
}
