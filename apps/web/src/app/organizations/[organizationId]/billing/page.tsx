import { requireSession, getOrganizationContext } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { CreditCard, ExternalLink, Activity, ShieldAlert, Cpu, HardDrive } from "lucide-react";
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
  const context = await getOrganizationContext(organizationId);

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
        <PageHeader 
          breadcrumbs={[
            { label: context?.organization.name || "Workspace", href: `/organizations/${organizationId}/dashboard` },
            { label: "Billing" }
          ]}
          title="Billing"
          description="Manage workspace subscription and usage."
        />
        <Alert variant="destructive" className="mt-6">
          <ShieldAlert className="w-4 h-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to view billing information for this organization. 
            Only organization owners can access billing configuration.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  // Handle 500s or network failures
  if ((subResponse && !subResponse.ok) || (usageResponse && !usageResponse.ok)) {
    return (
      <Container>
        <PageHeader 
          breadcrumbs={[
            { label: context?.organization.name || "Workspace", href: `/organizations/${organizationId}/dashboard` },
            { label: "Billing" }
          ]}
          title="Billing"
          description="Manage workspace subscription and usage."
        />
        <Alert variant="destructive" className="mt-6">
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
  const totals = usageData?.totals || [];

  const apiCallsTotal = totals.find((t: any) => t.metric === "API_CALLS")?.quantity || 0;
  const aiTokensTotal = totals.find((t: any) => t.metric === "AI_TOKENS")?.quantity || 0;
  const storageTotal = totals.find((t: any) => t.metric === "STORAGE_MB")?.quantity || 0;

  const isActive = subscription?.status === "active";

  return (
    <Container className="space-y-6">
      <PageHeader 
        breadcrumbs={[
          { label: context?.organization.name || "Workspace", href: `/organizations/${organizationId}/dashboard` },
          { label: "Billing" }
        ]}
        title="Billing"
        description="Active subscription tier and verified resource consumption."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subscription Summary */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-md">
                  <CreditCard className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-semibold text-zinc-900">Subscription Plan</CardTitle>
              </div>
              <Badge variant={isActive ? "default" : "secondary"} className="capitalize text-[10px]">
                {subscription?.status || "Free"}
              </Badge>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Current Tier</div>
                <div className="text-2xl font-semibold text-zinc-950 capitalize tracking-tight">
                  {subscription?.plan ? `${subscription.plan} Plan` : "Free Community Plan"}
                </div>
              </div>

              {subscription?.currentPeriodEnd && (
                <div className="pt-3 border-t border-zinc-100">
                  <div className="text-xs text-zinc-500 mb-0.5">Billing Period Ends</div>
                  <div className="text-xs font-mono text-zinc-800">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric"
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </div>

          <div className="p-5 pt-0">
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href={`/organizations/${organizationId}/billing/subscription`} className="flex items-center justify-center gap-1.5">
                Manage subscription details
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </Card>

        {/* Usage Summary */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-zinc-100 text-zinc-700 rounded-md">
                  <Activity className="w-4 h-4" />
                </div>
                <CardTitle className="text-sm font-semibold text-zinc-900">Current Consumption</CardTitle>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Last 30 days</span>
            </CardHeader>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  API Calls
                </span>
                <span className="text-xs font-mono font-medium text-zinc-900">{apiCallsTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  AI Tokens
                </span>
                <span className="text-xs font-mono font-medium text-zinc-900">{aiTokensTotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  Storage
                </span>
                <span className="text-xs font-mono font-medium text-zinc-900">{storageTotal.toLocaleString()} MB</span>
              </div>
            </CardContent>
          </div>

          <div className="p-5 pt-0">
            <Button asChild variant="outline" size="sm" className="w-full text-xs">
              <Link href={`/organizations/${organizationId}/billing/usage`} className="flex items-center justify-center gap-1.5">
                View consumption breakdown
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Transparent Payment & Invoices note */}
      <Card className="bg-zinc-50/50 border-dashed p-4">
        <div className="text-xs text-zinc-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>Invoices, payment methods, and tax receipts are securely managed via the Stripe Customer Portal.</span>
          <Link
            href={`/organizations/${organizationId}/billing/subscription`}
            className="text-xs font-medium text-zinc-900 hover:underline shrink-0"
          >
            Access Customer Portal →
          </Link>
        </div>
      </Card>
    </Container>
  );
}
