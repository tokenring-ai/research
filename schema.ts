import z from "zod";

export const ResearchServiceConfigSchema = z.object({
  researchModel: z.string().default("auto?websearch"),
});
export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;