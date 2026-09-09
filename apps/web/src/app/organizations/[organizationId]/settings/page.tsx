import { getOrganizationContext, requireSession } from "@/lib/auth";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";

export default async function SettingsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireSession();
  
  // This validates session, membership, and returns the authoritative organization context
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; // Handled by layout
  }

  return (
    <Container className="max-w-3xl space-y-6">
      <PageHeader 
        breadcrumbs={[
          { label: context.organization.name, href: `/organizations/${organizationId}/dashboard` },
          { label: "Settings" }
        ]}
        title="Settings"
        description="Manage your workspace profile and view access roles."
      />

      <div className="space-y-6">
        <OrganizationSettingsForm 
          organizationId={organizationId}
          initialName={context.organization.name}
          role={context.role}
        />
      </div>
    </Container>
  );
}
