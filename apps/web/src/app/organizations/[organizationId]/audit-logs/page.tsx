import { getOrganizationContext, requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { AuditLogTable } from "@/components/audit/AuditLogTable";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

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

  let error = false;
  const res = await fetchWithSession(`/organizations/${organizationId}/audit-logs?limit=50`).catch(() => {
    error = true;
    return null;
  });

  if (res && !res.ok) {
    error = true;
  }

  const initialData = !error && res ? await res.json() : { auditLogs: [], nextCursor: undefined };

  return (
    <Container>
      <PageHeader 
        title="Audit Logs"
        description="A chronological ledger of events and actions within your organization."
      />

      {error ? (
        <Alert variant="destructive" className="mt-8">
          <ShieldAlert className="w-4 h-4" />
          <AlertTitle>Unable to load audit logs</AlertTitle>
          <AlertDescription>
            We couldn't retrieve the audit logs due to a server error. Please try again later.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="mt-8 overflow-hidden">
          <AuditLogTable 
            organizationId={organizationId} 
            initialData={initialData} 
          />
        </Card>
      )}
    </Container>
  );
}
