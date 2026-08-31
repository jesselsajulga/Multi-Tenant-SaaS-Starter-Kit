import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").trim(),
});
