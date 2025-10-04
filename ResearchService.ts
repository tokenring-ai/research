import {TokenRingService} from "@tokenring-ai/agent/types";
import {z} from "zod";

export const ResearchServiceConfigSchema = z.object({
  researchModel: z.string(),
});

export type ResearchServiceConfig = z.infer<typeof ResearchServiceConfigSchema>;

/**
 * The actual implementation of GhostIOService
 */
export default class ResearchService implements TokenRingService {
  name = "ResearchService";
  description = "Provides Research functionality";
  researchModel: string;

  constructor({ researchModel }: ResearchServiceConfig) {
    this.researchModel = researchModel;
  }
}