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

import { AppShell } from "@/components/layout/app-shell";

export default async function OrganizationLayout({ children, params }: OrganizationLayoutProps) {
  const { organizationId } = await params;

  // 1. Authenticate user
  const session = await requireSession();

  // 2. Authorize organization access
  const context = await requireOrganizationAccess(organizationId);

  // 3. Fetch all organizations for the switcher
  const organizations = await getUserOrganizations();

  return (
    <AppShell
      header={
        <Header 
          session={session} 
          organizations={organizations} 
          currentOrganizationId={organizationId} 
        />
      }
      sidebar={
        <Sidebar 
          organizationId={organizationId} 
          role={context.role} 
        />
      }
    >
      <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </div>
    </AppShell>
  );
}
