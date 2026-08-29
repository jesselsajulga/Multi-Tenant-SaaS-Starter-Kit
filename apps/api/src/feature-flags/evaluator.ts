import { getTenantPrisma } from "../db";

/**
 * Evaluates a feature flag for a given organization.
 * 
 * Semantics:
 * - If the flag exists and is enabled, returns true.
 * - If the flag exists and is disabled, returns false.
 * - If the flag does not exist, returns false (fail-closed).
 * - Enforces tenant isolation natively via getTenantPrisma.
 */
export async function isFeatureEnabled(
  organizationId: string,
  key: string
): Promise<boolean> {
  const tenant = getTenantPrisma(organizationId);

  try {
    const flag = await tenant.featureFlag.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
      select: {
        enabled: true,
      },
    });

    return flag?.enabled ?? false;
  } catch (error) {
    // Treat database errors/RLS issues as fail-closed
    return false;
  }
}
