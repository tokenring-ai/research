import { AgentStateSlice } from "@tokenring-ai/agent/types";
import { z } from "zod";
import type { ParsedResearchConfig } from "../schema.ts";

const serializationSchema = z.object({
  researchDirectory: z.string(),
});

export class ResearchState extends AgentStateSlice<typeof serializationSchema> {
  researchDirectory: string;

  constructor(readonly initialConfig: ParsedResearchConfig["agentDefaults"]) {
    super("ResearchState", serializationSchema);
    this.researchDirectory = initialConfig.researchDirectory;
  }

  serialize(): z.output<typeof serializationSchema> {
    return { researchDirectory: this.researchDirectory };
  }

  deserialize(data: z.output<typeof serializationSchema>): void {
    this.researchDirectory = data.researchDirectory;
  }

  show(): string {
    return `Research Directory: ${this.researchDirectory}`;
  }
}
