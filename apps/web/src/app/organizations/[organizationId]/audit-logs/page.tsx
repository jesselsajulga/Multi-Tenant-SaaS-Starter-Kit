import { getOrganizationContext, requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { redirect } from "next/navigation";

export default async function AuditLogsPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  await requireSession();
  
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; 
  }

  if (context.role !== "OWNER") {
    redirect(`/organizations/${organizationId}/dashboard`);
  }

  const res = await fetchWithSession(`/organizations/${organizationId}/audit-logs?limit=50`).catch(() => null);
  const initialData = res?.ok ? await res.json() : { auditLogs: [], nextCursor: undefined };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Audit Logs
        </h1>
        <p className="text-zinc-600">
          A chronological ledger of events and actions within your organization.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <AuditLogTable 
          organizationId={organizationId} 
          initialData={initialData} 
        />
      </div>
    </div>
  );
}
