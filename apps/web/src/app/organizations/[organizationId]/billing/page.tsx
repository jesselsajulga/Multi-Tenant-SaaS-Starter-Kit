import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { CreditCard, ExternalLink, Activity } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function BillingOverviewPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await requireSession();

  // Fetch subscription and usage data concurrently
  const [subRes, usageRes] = await Promise.allSettled([
    fetchWithSession(`/organizations/${organizationId}/billing/subscription`),
    fetchWithSession(`/organizations/${organizationId}/billing/usage`)
  ]);

  const subResponse = subRes.status === "fulfilled" ? subRes.value : null;
  const usageResponse = usageRes.status === "fulfilled" ? usageRes.value : null;

  // Handle 403 authorization
  if (subResponse?.status === 403 || usageResponse?.status === 403) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to view billing information for this organization. 
            Only owners can access this data.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  // Handle 500s or network failures
  if ((subResponse && !subResponse.ok) || (usageResponse && !usageResponse.ok)) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTitle>Unable to load billing data</AlertTitle>
          <AlertDescription>
            We couldn't retrieve your billing overview due to a server error. Please try again later.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  const subData = subResponse ? await subResponse.json() : null;
  const usageData = usageResponse ? await usageResponse.json() : null;

  const subscription = subData?.subscription;
  
  // Basic usage calculations
  const totalEvents = usageData?.events?.length || 0;
  const thisMonthTotal = totalEvents;

  return (
    <Container>
      <PageHeader 
        title="Billing Overview"
        description="Manage your subscription and monitor your usage."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Subscription Summary */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-sm font-medium text-zinc-500 mb-1">Current Plan</div>
                <div className="text-xl font-semibold text-zinc-900 capitalize">
                  {subscription?.plan || "Free"}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-zinc-500 mb-1">Status</div>
                <Badge variant={subscription?.status === "active" ? "default" : "secondary"} className="capitalize">
                  {subscription?.status || "No active subscription"}
                </Badge>
              </div>

              {subscription?.currentPeriodEnd && (
                <div>
                  <div className="text-sm font-medium text-zinc-500 mb-1">Period Ends</div>
                  <div className="text-sm text-zinc-900">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100">
              <Button asChild variant="link" className="px-0 h-auto font-medium text-blue-600 hover:text-blue-500">
                <Link href={`/organizations/${organizationId}/billing/subscription`} className="flex items-center gap-1">
                  View subscription details
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Summary */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <CardTitle className="text-lg">Usage Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="flex-1 space-y-4">
              <div>
                <div className="text-sm font-medium text-zinc-500 mb-1">Total Events (30d)</div>
                <div className="text-3xl font-semibold text-zinc-900">
                  {thisMonthTotal.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-zinc-100">
              <Button asChild variant="link" className="px-0 h-auto font-medium text-purple-600 hover:text-purple-500">
                <Link href={`/organizations/${organizationId}/billing/usage`} className="flex items-center gap-1">
                  View detailed usage
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
