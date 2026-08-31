import { fetchWithSession } from "@/lib/api";
import { UsageDashboardClient } from "./usage-dashboard-client";
import { ServerCrash, ShieldAlert } from "lucide-react";

export default async function UsagePage(props: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { organizationId } = await props.params;
  const searchParams = await props.searchParams;
  
  // Pass query params down (startDate, endDate)
  const qs = new URLSearchParams();
  if (searchParams.startDate) qs.set("startDate", searchParams.startDate);
  if (searchParams.endDate) qs.set("endDate", searchParams.endDate);
  
  const queryStr = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetchWithSession(`/organizations/${organizationId}/billing/usage${queryStr}`);
  
  if (res.status === 401 || res.status === 403) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-red-100 bg-red-50">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-red-900 mb-2">Usage unavailable</h2>
        <p className="text-red-700 max-w-md">
          You don't have permission to view billing usage for this organization. 
          Only owners and administrators can access this data.
        </p>
      </div>
    );
  }

  if (!res.ok) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border border-zinc-200 bg-white">
        <ServerCrash className="w-12 h-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-900 mb-2">Unable to load usage</h2>
        <p className="text-zinc-500 max-w-md mb-6">
          We couldn't retrieve your usage data due to a server error. Please try again later.
        </p>
        <a 
          href={`/organizations/${organizationId}/billing/usage`} 
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Retry
        </a>
      </div>
    );
  }

  const data = await res.json();

  return (
    <div className="space-y-6">
      <UsageDashboardClient organizationId={organizationId} initialData={data} />
    </div>
  );
}
