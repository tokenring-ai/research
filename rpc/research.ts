import type TokenRingApp from "@tokenring-ai/app";
import { createRPCEndpoint } from "@tokenring-ai/rpc/createRPCEndpoint";
import { stripUndefinedKeys } from "@tokenring-ai/utility/object/stripObject";
import ResearchService from "../ResearchService.ts";
import ResearchRpcSchema from "./schema.ts";

export default createRPCEndpoint(ResearchRpcSchema, {
  startResearch(args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    return researchService.startResearch(args.query, stripUndefinedKeys({ headless: args.headless }));
  },

  getResearchConfig(_args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    return {
      researchDirectory: researchService.resolveResearchDirectory(),
    };
  },

  listResearchProjects(_args, app: TokenRingApp) {
    const researchService = app.requireService(ResearchService);
    return {
      projects: researchService.listResearchProjects(),
    };
  },
});
