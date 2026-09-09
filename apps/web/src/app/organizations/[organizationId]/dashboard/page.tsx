import { cookies } from "next/headers";
import { getOrganizationContext, requireSession } from "@/lib/auth";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { WorkspaceOverview } from "@/components/dashboard/WorkspaceOverview";
import { UsageSummaryCard } from "@/components/dashboard/UsageSummaryCard";
import { RecentMembersList } from "@/components/dashboard/RecentMembersList";
import type { MemberData } from "@/components/dashboard/RecentMembersList";
import { Container } from "@/components/layout/container";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchMembers(organizationId: string, sessionValue: string) {
  const res = await fetch(`${API_URL}/organizations/${organizationId}/members`, {
    headers: { Cookie: `session=${sessionValue}` },
    cache: "no-store",
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch members: ${res.status}`);
  }
  
  const data = await res.json();
  return data.members as MemberData[];
}

async function fetchUsage(organizationId: string, sessionValue: string) {
  const res = await fetch(`${API_URL}/organizations/${organizationId}/billing/usage`, {
    headers: { Cookie: `session=${sessionValue}` },
    cache: "no-store",
  });
  
  if (res.status === 403 || res.status === 401) {
    return { data: null, error: false, forbidden: true };
  }
  
  if (!res.ok) {
    return { data: null, error: true, forbidden: false };
  }
  
  const rawData = await res.json();
  
  // Transform backend UsageReport into the component's UsageData shape
  const data = {
    apiCalls: rawData.totals?.find((t: any) => t.metric === "API_CALLS")?.quantity || 0,
    aiTokens: rawData.totals?.find((t: any) => t.metric === "AI_TOKENS")?.quantity || 0,
    storageMb: rawData.totals?.find((t: any) => t.metric === "STORAGE_MB")?.quantity || 0,
  };
  
  return { data, error: false, forbidden: false };
}

export default async function DashboardPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const session = await requireSession();
  const context = await getOrganizationContext(organizationId);

  if (!context) {
    return null; // Handled by layout
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get("session")?.value || "";

  // Fetch data in parallel
  const [membersResult, usageResult] = await Promise.allSettled([
    fetchMembers(organizationId, sessionValue),
    fetchUsage(organizationId, sessionValue)
  ]);

  const members = membersResult.status === "fulfilled" ? membersResult.value : null;
  
  // If user is MEMBER, usageResult will be fulfilled with { forbidden: true }
  // If 500 error, usageResult fulfilled with { error: true }
  const usage = usageResult.status === "fulfilled" ? usageResult.value : { data: null, error: true, forbidden: false };

  return (
    <Container>
      <DashboardGreeting 
        email={session.user.email} 
        organizationName={context.organization.name}
        organizationId={organizationId}
      />

      {members === null ? (
        <Alert variant="destructive" className="mb-8">
          <AlertDescription>
            Unable to load workspace members.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <WorkspaceOverview totalMembers={members.length} organizationId={organizationId} />
          </div>
          
          {!usage.forbidden && (
            <div className="lg:col-span-2">
              <UsageSummaryCard 
                organizationId={organizationId} 
                usageData={usage.data} 
                error={usage.error} 
              />
            </div>
          )}
        </div>
      )}

      {members !== null && (
        <div className="mt-8">
          <RecentMembersList members={members} />
        </div>
      )}
    </Container>
  );
}
