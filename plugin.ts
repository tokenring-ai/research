import type { TokenRingPlugin } from "@tokenring-ai/app";
import { ChatService } from "@tokenring-ai/chat";
import { RpcService } from "@tokenring-ai/rpc";
import { z } from "zod";
import packageJSON from "./package.json" with { type: "json" };
import ResearchService from "./ResearchService.ts";
import researchRPC from "./rpc/research.ts";
import { ResearchServiceConfigSchema } from "./schema.ts";
import tools from "./tools.ts";

const packageConfigSchema = z.object({
  research: ResearchServiceConfigSchema,
});

export default {
  name: packageJSON.name,
  displayName: "Research",
  version: packageJSON.version,
  description: packageJSON.description,
  install(app, config) {
    const researchService = new ResearchService(config.research);
    app.addServices(researchService);
    app.waitForService(ChatService, chatService => chatService.addTools(...tools));
    app.waitForService(RpcService, rpcService => {
      rpcService.registerEndpoint(researchRPC);
    });
  },
  configSchema: packageConfigSchema,
} satisfies TokenRingPlugin<typeof packageConfigSchema>;
