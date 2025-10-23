import {AgentTeam, TokenRingPackage} from "@tokenring-ai/agent";
import {ScriptingService} from "@tokenring-ai/scripting";
import {ScriptingThis} from "@tokenring-ai/scripting/ScriptingService.js";
import packageJSON from './package.json' with {type: 'json'};
import ResearchService, {ResearchServiceConfigSchema} from "./ResearchService.ts";

import * as tools from "./tools.ts";

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(agentTeam: AgentTeam) {
    agentTeam.services.waitForItemByType(ScriptingService).then((scriptingService: ScriptingService) => {
      scriptingService.registerFunction("research", {
          type: 'native',
          params: ["topic", "prompt"],
          async execute(this: ScriptingThis, topic: string, prompt: string): Promise<string> {
            return await this.agent.requireServiceByType(ResearchService).runResearch(topic, prompt, this.agent);
          }
        }
      );
    });
    agentTeam.addTools(packageJSON.name, tools);
    const config = agentTeam.getConfigSlice('research', ResearchServiceConfigSchema.optional());
    if (config) {
      agentTeam.addServices(new ResearchService(config));
    }
  },
} as TokenRingPackage;

export {default as ResearchService} from "./ResearchService.ts";