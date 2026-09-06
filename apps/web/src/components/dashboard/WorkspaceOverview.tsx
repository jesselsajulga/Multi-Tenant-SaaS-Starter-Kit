import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspaceOverview({ totalMembers }: { totalMembers: number }) {
  return (
    <Card className="flex flex-col justify-center h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-zinc-500">Total Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-zinc-900">{totalMembers}</div>
      </CardContent>
    </Card>
  );
}
