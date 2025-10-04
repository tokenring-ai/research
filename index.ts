import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import packageJSON from './package.json' with {type: 'json'};
import ResearchService, {ResearchServiceConfigSchema} from "./ResearchService";

import * as tools from "./tools.ts";

export const packageInfo: TokenRingPackage = {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    agentTeam.addTools(packageInfo, tools);
    const config = agentTeam.getConfigSlice('research', ResearchServiceConfigSchema.optional());
    if (config) {
      agentTeam.addServices(new ResearchService(config));
    }
  },
};

export {default as ResearchService} from "./ResearchService.ts";