import Link from "next/link";
import { ArrowRight, Users, UserCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export function WorkspaceOverview({
  totalMembers,
  organizationId,
}: {
  totalMembers: number;
  organizationId: string;
}) {
  return (
    <Card className="flex flex-col justify-between h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-500">Workspace Team</CardTitle>
          <div className="p-1.5 bg-zinc-100 text-zinc-600 rounded-md">
            <Users className="w-4 h-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-3xl font-semibold text-zinc-950 tracking-tight">{totalMembers}</div>
        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
          <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
          <span>Active member{totalMembers === 1 ? "" : "s"} with workspace access</span>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t border-zinc-100">
        <Link
          href={`/organizations/${organizationId}/team`}
          className="text-xs font-medium text-zinc-700 hover:text-zinc-950 flex items-center gap-1 transition-colors"
        >
          Manage team members <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
