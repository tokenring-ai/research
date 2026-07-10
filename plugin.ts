import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RpcService } from "@tokenring-ai/rpc";
import { ScriptingService } from "@tokenring-ai/scripting";
import type { ScriptingThis } from "@tokenring-ai/scripting/ScriptingService";
import { z } from "zod";
import packageJSON from "./package.json" with { type: "json" };
import ResearchService from "./ResearchService.ts";
import researchRPC from "./rpc/research.ts";
import { ResearchServiceConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema.prefault({}),
});

export default {
  name: packageJSON.name,
  displayName: "Research Tools",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const checkpointConfig = (app.config as { checkpoint?: { projectDirectory?: string } }).checkpoint;
    const projectDirectory = checkpointConfig?.projectDirectory;

    const researchService = new ResearchService(app, config.research, projectDirectory);
    app.addServices(researchService);

    app.services.waitForItemByType(ScriptingService, (scriptingService: ScriptingService) => {
      scriptingService.registerFunction("research", {
        type: "native",
        params: ["topic", "prompt"],
        async execute(this: ScriptingThis, topic: string, prompt: string): Promise<string> {
          const query = prompt.trim() ? `${topic}: ${prompt}` : topic;
          const result = this.agent.requireServiceByType(ResearchService).startResearch(query, {
            headless: this.agent.headless,
          });
          return JSON.stringify(result);
        },
      });
    });

    app.waitForService(ChatService, chatService => chatService.addTools(...tools));

    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(researchRPC);
    });
  },
  config: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
