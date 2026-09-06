import { fetchWithSession } from "@/lib/api";
import { UsageDashboardClient } from "./usage-dashboard-client";
import { ServerCrash, ShieldAlert } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      <Container>
        <Alert variant="destructive" className="flex flex-col items-center text-center p-8 mt-8">
          <ShieldAlert className="w-12 h-12 text-red-500 mb-4 static" />
          <AlertTitle className="text-lg mb-2">Usage unavailable</AlertTitle>
          <AlertDescription className="max-w-md">
            You don't have permission to view billing usage for this organization. 
            Only owners and administrators can access this data.
          </AlertDescription>
        </Alert>
      </Container>
    );
  }

  if (!res.ok) {
    return (
      <Container>
        <Alert variant="default" className="flex flex-col items-center text-center p-8 mt-8">
          <ServerCrash className="w-12 h-12 text-zinc-400 mb-4 static" />
          <AlertTitle className="text-lg mb-2">Unable to load usage</AlertTitle>
          <AlertDescription className="max-w-md mb-6">
            We couldn't retrieve your usage data due to a server error. Please try again later.
          </AlertDescription>
          <Button asChild>
            <Link href={`/organizations/${organizationId}/billing/usage`}>
              Retry
            </Link>
          </Button>
        </Alert>
      </Container>
    );
  }

  const data = await res.json();

  return (
    <Container>
      <UsageDashboardClient organizationId={organizationId} initialData={data} />
    </Container>
  );
}
