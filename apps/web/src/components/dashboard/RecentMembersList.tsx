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
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200">
        <h3 className="font-semibold text-zinc-900">Recent Members</h3>
      </div>
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
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 shrink-0">
                      {member.user.email.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="font-medium text-zinc-900 truncate max-w-[200px]">
                      {member.user.email}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700">
                    {member.role}
                  </span>
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
    </div>
  );
}
