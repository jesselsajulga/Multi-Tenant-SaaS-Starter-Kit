import { z } from "zod";

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(255),
  enabled: z.boolean(),
});

export const updateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
});

export const featureFlagParamsSchema = z.object({
  organizationId: z.string().uuid(),
  flagId: z.string().uuid(),
});

export const featureFlagOrgParamsSchema = z.object({
  organizationId: z.string().uuid(),
});
