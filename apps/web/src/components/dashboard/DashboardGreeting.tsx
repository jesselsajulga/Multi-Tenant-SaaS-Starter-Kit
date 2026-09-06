import { PageHeader } from "@/components/layout/page-header";

export function DashboardGreeting({ email, organizationName }: { email: string; organizationName: string }) {
  return (
    <div className="mb-8">
      <PageHeader
        title={`Good morning, ${email}`}
        description={`Here's what's happening in ${organizationName}.`}
      />
    </div>
  );
}
