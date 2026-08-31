import { getOrganizationContext, requireSession } from "@/lib/auth";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";

export default async function SettingsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireSession();
  
  // This validates session, membership, and returns the authoritative organization context
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; // Handled by layout
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Settings
        </h1>
        <p className="text-zinc-600">
          Manage your organization's configuration.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden p-6 sm:p-8">
        <OrganizationSettingsForm 
          organizationId={organizationId}
          initialName={context.organization.name}
          role={context.role}
        />
      </div>
    </div>
  );
}
