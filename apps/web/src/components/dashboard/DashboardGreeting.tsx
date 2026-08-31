export function DashboardGreeting({ email, organizationName }: { email: string; organizationName: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
        Good morning, {email}
      </h1>
      <p className="text-zinc-600">
        Here's what's happening in {organizationName}.
      </p>
    </div>
  );
}
