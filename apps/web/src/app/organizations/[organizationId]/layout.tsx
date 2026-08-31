import { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { requireSession, requireOrganizationAccess, getUserOrganizations } from "@/lib/auth";

interface OrganizationLayoutProps {
  children: ReactNode;
  params: Promise<{
    organizationId: string;
  }>;
}

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { organizationId } = await params;

  // 1. Authenticate user
  const session = await requireSession();

  // 2. Authorize organization access
  const context = await requireOrganizationAccess(organizationId);

  // 3. Fetch all organizations for the switcher
  const organizations = await getUserOrganizations();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col text-zinc-900 font-sans">
      <Header 
        session={session} 
        organizations={organizations} 
        currentOrganizationId={organizationId} 
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          organizationId={organizationId} 
          role={context.role} 
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-zinc-50">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
