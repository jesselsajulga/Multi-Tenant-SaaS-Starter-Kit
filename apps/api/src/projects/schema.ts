import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
