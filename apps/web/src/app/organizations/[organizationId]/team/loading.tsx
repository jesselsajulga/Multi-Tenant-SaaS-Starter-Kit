import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <Container>
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="space-y-8">
        <Skeleton className="h-[400px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </Container>
  );
}
