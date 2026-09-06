import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { CreditCard } from "lucide-react";
import { SubscriptionClient } from "./SubscriptionClient";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  await requireSession();

  const res = await fetchWithSession(`/organizations/${organizationId}/billing/subscription`);

  if (res.status === 403) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don't have permission to manage subscriptions. Only owners can access this area.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (!res.ok) {
    return (
      <Container>
        <Alert variant="destructive">
          <AlertTitle>Unable to load subscription</AlertTitle>
          <AlertDescription>
            We couldn't retrieve your subscription details due to a server error. Please try again later.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  const data = await res.json();
  const subscription = data.subscription;
  const hasSubscription = !!subscription?.status;

  return (
    <Container className="max-w-3xl">
      <PageHeader 
        title="Subscription"
        description="Manage your organization's subscription plan and billing details."
      />

      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-6 border-b border-zinc-100 mb-6">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <CardDescription>Your workspace's active subscription status</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-zinc-500 mb-1">Plan Level</div>
                <div className="text-xl font-semibold text-zinc-900 capitalize">
                  {subscription?.plan || "Free"}
                </div>
              </div>
              
              <div className="sm:text-right">
                <div className="text-sm font-medium text-zinc-500 mb-1">Status</div>
                <Badge variant={subscription?.status === "active" ? "default" : "secondary"} className="capitalize">
                  {subscription?.status || "No active subscription"}
                </Badge>
              </div>
            </div>

            {subscription?.currentPeriodEnd && (
              <div className="pt-6 border-t border-zinc-100">
                <div className="text-sm font-medium text-zinc-500 mb-1">Current Period Ends</div>
                <div className="text-sm text-zinc-900">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            )}
          </div>

          <SubscriptionClient 
            organizationId={organizationId} 
            hasSubscription={hasSubscription} 
          />
        </CardContent>
      </Card>
    </Container>
  );
}
