import { getOrganizationContext, requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { redirect } from "next/navigation";
import { FeatureFlagManager } from "@/components/feature-flags/FeatureFlagManager";

export default async function FeatureFlagsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireSession();
  
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; 
  }

  if (context.role !== "OWNER") {
    redirect(`/organizations/${organizationId}/dashboard`);
  }

  const res = await fetchWithSession(`/organizations/${organizationId}/feature-flags`).catch(() => null);
  const initialFlags = res?.ok ? await res.json() : [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Feature Flags
        </h1>
        <p className="text-zinc-600">
          Manage dynamic capabilities and progressive rollouts for your organization.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <FeatureFlagManager 
          organizationId={organizationId} 
          initialFlags={initialFlags} 
        />
      </div>
    </div>
  );
}
