import type { ConfigFieldMeta } from "@tokenring-ai/app/config/metadata";
import z from "zod";

export const ResearchServiceConfigSchema = z
  .object({
    /**
     * Directory where deep research projects are written.
     * Relative paths are resolved against the project directory when provided.
     */
    researchDirectory: z
      .string()
      .default(".tokenring/research")
      .meta({ description: "Directory where deep research projects are written" } satisfies ConfigFieldMeta),
  })
  .meta({ label: "Research", description: "Deep research project settings" } satisfies ConfigFieldMeta);
export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;
