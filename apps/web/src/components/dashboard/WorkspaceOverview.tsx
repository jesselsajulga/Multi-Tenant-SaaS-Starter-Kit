export function WorkspaceOverview({ totalMembers }: { totalMembers: number }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm flex flex-col justify-center">
      <div className="text-sm font-medium text-zinc-500 mb-1">Total Members</div>
      <div className="text-3xl font-semibold text-zinc-900">{totalMembers}</div>
    </div>
  );
}
