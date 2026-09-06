import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <Container>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </div>
        
        <div className="lg:col-span-2">
          <Skeleton className="h-[120px] w-full rounded-lg" />
        </div>
      </div>

      <div className="mt-8">
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </Container>
  );
}
