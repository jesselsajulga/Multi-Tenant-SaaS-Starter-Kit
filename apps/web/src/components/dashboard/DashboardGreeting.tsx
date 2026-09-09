import { PageHeader } from "@/components/layout/page-header";

interface DashboardGreetingProps {
  email: string;
  organizationName: string;
  organizationId: string;
}

export function DashboardGreeting({ email, organizationName, organizationId }: DashboardGreetingProps) {
  const username = email.split("@")[0];

  return (
    <div className="mb-6">
      <PageHeader
        breadcrumbs={[
          { label: organizationName, href: `/organizations/${organizationId}/dashboard` },
          { label: "Dashboard" }
        ]}
        title="Dashboard"
        description={`Overview and operational status for ${organizationName}. Welcome back, ${username}.`}
      />
    </div>
  );
}
