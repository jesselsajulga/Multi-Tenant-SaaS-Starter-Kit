import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
});

export const processInvitationSchema = z.object({
  token: z.string().min(1),
});
