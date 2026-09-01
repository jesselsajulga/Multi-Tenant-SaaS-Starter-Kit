import { requireSession } from "@/lib/auth";
import { fetchWithSession } from "@/lib/api";
import { ServerCrash, ShieldAlert, CreditCard, ExternalLink } from "lucide-react";
import Link from "next/link";

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
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-red-100 bg-red-50">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-red-900 mb-2">Access Denied</h2>
        <p className="text-red-700 max-w-md">
          You don't have permission to view billing information for this organization. 
          Only owners can access this data.
        </p>
      </div>
    );
  }

  // Handle 500s or network failures
  if ((subResponse && !subResponse.ok) || (usageResponse && !usageResponse.ok)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <ServerCrash className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Unable to load billing data</h2>
        <p className="text-zinc-500 max-w-md mb-6">
          We couldn't retrieve your billing overview due to a server error. Please try again later.
        </p>
      </div>
    );
  }

  const subData = subResponse ? await subResponse.json() : null;
  const usageData = usageResponse ? await usageResponse.json() : null;

  const subscription = subData?.subscription;
  
  // Basic usage calculations (same as Phase 8.7 Dashboard)
  const totalEvents = usageData?.events?.length || 0;
  const thisMonthTotal = totalEvents; // Keeping it simple for the overview

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
          Billing Overview
        </h1>
        <p className="text-zinc-600">
          Manage your subscription and monitor your usage.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subscription Summary */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900">Subscription</h2>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <div className="text-sm font-medium text-zinc-500 mb-1">Current Plan</div>
              <div className="text-xl font-semibold text-zinc-900 capitalize">
                {subscription?.plan || "Free"}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-zinc-500 mb-1">Status</div>
              <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 capitalize">
                {subscription?.status || "No active subscription"}
              </div>
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
            <Link 
              href={`/organizations/${organizationId}/billing/subscription`}
              className="text-sm font-medium text-blue-600 hover:text-blue-500 flex items-center gap-1"
            >
              View subscription details
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Usage Summary */}
        <div className="bg-white border border-zinc-200 rounded-lg p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-medium text-zinc-900">Usage Snapshot</h2>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <div className="text-sm font-medium text-zinc-500 mb-1">Total Events (30d)</div>
              <div className="text-3xl font-semibold text-zinc-900">
                {thisMonthTotal.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <Link 
              href={`/organizations/${organizationId}/billing/usage`}
              className="text-sm font-medium text-purple-600 hover:text-purple-500 flex items-center gap-1"
            >
              View detailed usage
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
