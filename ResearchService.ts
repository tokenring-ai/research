import {TokenRingService} from "@tokenring-ai/agent/types";

export interface ResearchServiceConfig {
  researchModel: string;
}

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