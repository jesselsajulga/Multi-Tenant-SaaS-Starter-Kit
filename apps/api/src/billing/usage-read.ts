import { getTenantPrisma } from "../db";
import { Prisma } from "../generated/prisma/client";

export interface UsageQueryOptions {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  metric?: string;
}

export interface UsageTotal {
  metric: string;
  quantity: number;
}

export interface UsageHistoryItem {
  date: string; // YYYY-MM-DD in UTC
  metric: string;
  quantity: number;
}

export interface UsageReport {
  period: {
    start: string;
    end: string;
  };
  totals: UsageTotal[];
  history: UsageHistoryItem[];
}

export async function getOrganizationUsage(options: UsageQueryOptions): Promise<UsageReport> {
  const { organizationId, startDate, endDate, metric } = options;
  const tenantPrisma = getTenantPrisma(organizationId);

  // Construct where clause enforcing (occurredAt ?? createdAt) is within [startDate, endDate)
  const whereClause: Prisma.UsageEventWhereInput = {
    organizationId,
    ...(metric ? { metric } : {}),
    OR: [
      {
        occurredAt: { not: null, gte: startDate, lt: endDate }
      },
      {
        occurredAt: null,
        createdAt: { gte: startDate, lt: endDate }
      }
    ]
  };

  // Fetch all matching events to aggregate in-memory (safest for RLS and complex date math)
  // For massive scale, this could be optimized, but since this is isolated per-tenant
  // and filtered by date/metric, in-memory reduces risk of breaking RLS with raw queries.
  const events = await tenantPrisma.usageEvent.findMany({
    where: whereClause,
    select: {
      metric: true,
      quantity: true,
      occurredAt: true,
      createdAt: true
    }
  });

  const totalsMap = new Map<string, number>();
  // Map of "YYYY-MM-DD" -> Map of "metric" -> quantity
  const historyMap = new Map<string, Map<string, number>>();

  for (const event of events) {
    const effectiveDate = event.occurredAt || event.createdAt;
    // Format to YYYY-MM-DD in UTC
    const dateStr = effectiveDate.toISOString().split('T')[0];

    // Accumulate total
    const currentTotal = totalsMap.get(event.metric) || 0;
    totalsMap.set(event.metric, currentTotal + event.quantity);

    // Accumulate history
    if (!historyMap.has(dateStr)) {
      historyMap.set(dateStr, new Map());
    }
    const dayMetrics = historyMap.get(dateStr)!;
    const currentDayTotal = dayMetrics.get(event.metric) || 0;
    dayMetrics.set(event.metric, currentDayTotal + event.quantity);
  }

  // Format arrays
  const totals: UsageTotal[] = Array.from(totalsMap.entries()).map(([m, quantity]) => ({
    metric: m,
    quantity
  }));

  const history: UsageHistoryItem[] = [];
  for (const [dateStr, metricsMap] of Array.from(historyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const [m, quantity] of metricsMap.entries()) {
      history.push({
        date: dateStr,
        metric: m,
        quantity
      });
    }
  }

  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    totals,
    history
  };
}
