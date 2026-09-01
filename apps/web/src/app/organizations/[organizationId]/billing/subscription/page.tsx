import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { ServerCrash, ShieldAlert, CreditCard } from "lucide-react";
import { SubscriptionClient } from "./SubscriptionClient";

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
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-red-100 bg-red-50">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h2>
        <p className="text-red-700 max-w-md">
          You don't have permission to manage subscriptions. Only owners can access this area.
        </p>
      </div>
    );
  }

  if (!res.ok) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <ServerCrash className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Unable to load subscription</h2>
        <p className="text-zinc-500 max-w-md mb-6">
          We couldn't retrieve your subscription details due to a server error. Please try again later.
        </p>
      </div>
    );
  }

  const data = await res.json();
  const subscription = data.subscription;
  const hasSubscription = !!subscription?.status;

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Subscription
        </h1>
        <p className="text-zinc-600">
          Manage your organization's subscription plan and billing details.
        </p>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-100">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-zinc-900">Current Plan</h2>
            <p className="text-sm text-zinc-500">Your workspace's active subscription status</p>
          </div>
        </div>

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
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 capitalize">
                {subscription?.status || "No active subscription"}
              </div>
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
      </div>
    </div>
  );
}
