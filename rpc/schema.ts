import type { RPCSchema } from "@tokenring-ai/rpc/types";
import { z } from "zod";

export default {
  name: "Research RPC",
  path: "/rpc/research",
  methods: {
    startResearch: {
      type: "mutation",
      input: z.object({
        query: z.string().min(1),
        headless: z.boolean().exactOptional(),
      }),
      result: z.object({
        agentId: z.string(),
        researchDirectory: z.string(),
      }),
    },
    getResearchConfig: {
      type: "query",
      input: z.object({}),
      result: z.object({
        researchDirectory: z.string(),
      }),
    },
    listResearchProjects: {
      type: "query",
      input: z.object({}),
      result: z.object({
        projects: z.array(
          z.object({
            name: z.string(),
            path: z.string(),
            modifiedAt: z.number(),
          }),
        ),
      }),
    },
  },
} as const satisfies RPCSchema;
