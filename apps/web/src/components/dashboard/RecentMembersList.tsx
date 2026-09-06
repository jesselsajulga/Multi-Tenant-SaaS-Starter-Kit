import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export interface MemberData {
  id: string;
  role: string;
  createdAt: string;
  user: {
    email: string;
  };
}

export function RecentMembersList({ members }: { members: MemberData[] }) {
  // Take the 5 most recent (which means latest createdAt, but the API returns asc, so we reverse or slice from the end)
  const recent = [...members].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Members</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-3 font-medium">Member</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {recent.map((member) => (
                <tr key={member.id} className="hover:bg-zinc-50/50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-zinc-200 text-xs font-medium text-zinc-700">
                          {member.user.email.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-zinc-900 truncate max-w-[200px]">
                        {member.user.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant="secondary">
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-right text-zinc-500">
                    {new Date(member.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                    No members found
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
