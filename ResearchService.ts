import {Service} from "@token-ring/registry";

/**
 * The actual implementation of GhostIOService
 */
export default class ResearchService extends Service {
  researchModel: string;

  constructor({ researchModel }: { researchModel: string }) {
    super();
    this.researchModel = researchModel;
  }
}