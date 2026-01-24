import {TokenRingPlugin} from "@tokenring-ai/app";
import {ChatService} from "@tokenring-ai/chat";
import {ScriptingService} from "@tokenring-ai/scripting";
import {ScriptingThis} from "@tokenring-ai/scripting/ScriptingService";
import {z} from "zod";
import packageJSON from './package.json' with {type: 'json'};
import ResearchService, {ResearchServiceConfigSchema} from "./ResearchService.ts";

import tools from "./tools.ts";

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.optional()
});

export default {
  name: packageJSON.name,
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    app.services.waitForItemByType(ScriptingService, (scriptingService: ScriptingService) => {
      scriptingService.registerFunction("research", {
          type: 'native',
          params: ["topic", "prompt"],
          async execute(this: ScriptingThis, topic: string, prompt: string): Promise<string> {
            return await this.agent.requireServiceByType(ResearchService).runResearch(topic, prompt, this.agent);
          }
        }
      );
    });
    app.waitForService(ChatService, chatService =>
      chatService.addTools(tools)
    );
    if (config.research) {
      app.addServices(new ResearchService(config.research));
    }
  },
  config: packageConfigSchema
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
