import { z } from "zod";

export const getAuditLogsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});
