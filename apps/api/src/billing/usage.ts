import { z } from "zod";
import { getTenantPrisma } from "../db";
import { UsageEvent } from "../generated/prisma/client";

export const UsageMetricSchema = z.enum([
  "API_CALLS",
  "STORAGE_MB",
  "AI_TOKENS",
]);

export type UsageMetric = z.infer<typeof UsageMetricSchema>;

export const RecordUsageInputSchema = z.object({
  organizationId: z.string().uuid(),
  metric: UsageMetricSchema,
  quantity: z.number().int().positive(),
  occurredAt: z.date().optional(),
});

export type RecordUsageInput = z.infer<typeof RecordUsageInputSchema>;

/**
 * Centrally and securely records billable consumption into the immutable UsageEvent ledger.
 * 
 * Enforces strictly positive, non-zero integer quantities.
 * Automatically utilizes tenantPrisma to respect RLS boundaries.
 */
export async function recordUsage(input: RecordUsageInput): Promise<UsageEvent> {
  const validated = RecordUsageInputSchema.parse(input);

  const tenantPrisma = getTenantPrisma(validated.organizationId);

  const event = await tenantPrisma.usageEvent.create({
    data: {
      organizationId: validated.organizationId,
      metric: validated.metric,
      quantity: validated.quantity,
      occurredAt: validated.occurredAt,
    },
  });

  return event;
}
