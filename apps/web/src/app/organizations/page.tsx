import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { cookies } from "next/headers";
import { requireSession, getUserOrganizations } from "@/lib/auth";
import { UserMenu } from "@/components/shell/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CreateWorkspaceModal } from "@/components/shell/CreateWorkspaceModal";

import { RevocationBanner } from "@/components/notifications/RevocationBanner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getPendingInvitationsCount(sessionCookie: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/invitations/received`, {
      headers: {
        Cookie: `session=${sessionCookie}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return (data.invitations || []).length;
  } catch {
    return 0;
  }
}

interface OrganizationsPageProps {
  searchParams: Promise<{
    revoked?: string;
    workspace?: string;
  }>;
}

export default async function OrganizationsPage({ searchParams }: OrganizationsPageProps) {
  const session = await requireSession();
  const organizations = await getUserOrganizations();
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value || "";
  const pendingInvitationsCount = await getPendingInvitationsCount(sessionCookie);

  const params = await searchParams;
  const isRevoked = params?.revoked === "1";
  const revokedWorkspaceName = params?.workspace;

  // If exactly 1 workspace and no pending invitations to review, automatically open it,
  // UNLESS the user was just revoked / ejected from another workspace.
  if (!isRevoked && organizations.length === 1 && pendingInvitationsCount === 0) {
    redirect(`/organizations/${organizations[0].organization.id}/dashboard`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900">
      <header className="h-14 border-b border-zinc-200 bg-white flex items-center justify-between px-6">
        <div className="font-semibold text-lg tracking-tight">SaaSKit</div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <UserMenu session={session} />
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <RevocationBanner 
          isRevoked={isRevoked} 
          initialWorkspaceName={revokedWorkspaceName} 
        />
        {pendingInvitationsCount > 0 && (
          <div className="max-w-2xl w-full mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-md">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-950">
                  You have {pendingInvitationsCount} pending {pendingInvitationsCount === 1 ? "invitation" : "invitations"}
                </p>
                <p className="text-xs text-indigo-700">
                  Review and accept invitations to join other workspaces.
                </p>
              </div>
            </div>
            <Link
              href="/invitations"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
            >
              Review Invitations <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
        
        {organizations.length === 0 ? (
          <div className="max-w-md w-full bg-white border border-zinc-200 p-8 rounded-lg shadow-sm text-center">
            <h1 className="text-2xl font-semibold mb-2">Welcome to SaaSKit</h1>
            <p className="text-zinc-600 mb-6">
              You don't belong to any workspaces yet.
            </p>
            <CreateWorkspaceModal 
              buttonClassName="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
              buttonContent="Create a Workspace"
            />
          </div>
        ) : (
          <div className="max-w-2xl w-full">
            <h1 className="text-2xl font-semibold mb-2">Welcome back, {session.user.email.split('@')[0]}</h1>
            <p className="text-zinc-600 mb-8">Your Workspaces</p>
            
            <div className="grid gap-4 mb-8">
              {organizations.map((orgContext) => {
                const projectCount = orgContext.organization._count?.projects || 0;
                return (
                  <div key={orgContext.organization.id} className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-lg">{orgContext.organization.name}</h2>
                      <p className="text-zinc-500 text-sm">
                        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                      </p>
                    </div>
                    <Link
                      href={`/organizations/${orgContext.organization.id}/dashboard`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 rounded-md hover:bg-zinc-200 transition-colors w-max"
                    >
                      Open Workspace <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
            
            <CreateWorkspaceModal 
              buttonClassName="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              buttonContent="+ Create Workspace"
            />
          </div>
        )}

      </main>
    </div>
  );
}
