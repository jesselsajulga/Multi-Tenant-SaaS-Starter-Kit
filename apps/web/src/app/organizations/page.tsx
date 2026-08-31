import { redirect } from "next/navigation";
import { requireSession, getUserOrganizations } from "@/lib/auth";
import { UserMenu } from "@/components/shell/UserMenu";

export default async function OrganizationsPage() {
  const session = await requireSession();
  const organizations = await getUserOrganizations();

  if (organizations.length > 0) {
    redirect(`/organizations/${organizations[0].organization.id}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6">
        <div className="font-semibold text-lg tracking-tight">SaaSKit</div>
        <UserMenu session={session} />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full bg-white border border-zinc-200 p-8 rounded-lg shadow-sm text-center">
          <h1 className="text-2xl font-semibold mb-2">Welcome to SaaSKit</h1>
          <p className="text-zinc-600 mb-6">
            You don't belong to any workspaces yet.
          </p>
          <button 
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors cursor-not-allowed"
          >
            Create a Workspace
          </button>
        </div>
      </main>
    </div>
  );
}
