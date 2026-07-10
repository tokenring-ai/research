import z from "zod";

export const ResearchServiceConfigSchema = z.object({
  /**
   * Directory where deep research projects are written.
   * Relative paths are resolved against the project directory when provided.
   */
  researchDirectory: z.string().default(".tokenring/research"),
});
export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;
