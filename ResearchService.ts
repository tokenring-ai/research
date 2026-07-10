import fs from "node:fs";
import path from "node:path";
import type { Agent } from "@tokenring-ai/agent";
import AgentManager from "@tokenring-ai/agent/services/AgentManager";
import type { AgentCreationContext } from "@tokenring-ai/agent/types";
import type TokenRingApp from "@tokenring-ai/app";
import type { TokenRingService } from "@tokenring-ai/app/types";
import { FileSystemState } from "@tokenring-ai/filesystem/state/fileSystemState";
import type { ResearchServiceConfig } from "./schema.ts";

export type StartResearchOptions = {
  headless?: boolean;
};

export type StartResearchResult = {
  agentId: string;
  researchDirectory: string;
};

export type ResearchProjectSummary = {
  name: string;
  path: string;
  modifiedAt: number;
};

/**
 * Orchestrates deep research agents: working directory, spawn, and kickoff.
 */
export default class ResearchService implements TokenRingService {
  readonly name = "ResearchService";
  description = "Creates research agents and runs deep research workflows";

  private projectDirectory: string;

  constructor(
    private app: TokenRingApp,
    private options: ResearchServiceConfig,
    projectDirectory?: string,
  ) {
    this.projectDirectory = projectDirectory ?? process.cwd();
  }

  /**
   * Resolve the configured research directory to an absolute path.
   */
  resolveResearchDirectory(): string {
    const configured = this.options.researchDirectory;
    if (path.isAbsolute(configured)) {
      return path.normalize(configured);
    }
    return path.resolve(this.projectDirectory, configured);
  }

  /**
   * Ensure the research root directory exists on disk.
   */
  ensureResearchDirectory(): string {
    const dir = this.resolveResearchDirectory();
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Point an agent's filesystem working directory at the research root.
   */
  applyWorkingDirectory(agent: Agent): void {
    const researchDirectory = this.ensureResearchDirectory();
    agent.mutateState(FileSystemState, state => {
      state.workingDirectory = researchDirectory;
    });
  }

  attach(agent: Agent, _creationContext: AgentCreationContext): void {
    if (agent.config.agentType === "research") {
      this.applyWorkingDirectory(agent);
    }
  }

  /**
   * Spawn a research agent under the research directory and start `/deep research`.
   */
  startResearch(query: string, options: StartResearchOptions = {}): StartResearchResult {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new Error("Research query must not be empty");
    }

    const researchDirectory = this.ensureResearchDirectory();
    const agentManager = this.app.requireService(AgentManager);
    const agent = agentManager.spawnAgent({
      agentType: "research",
      headless: options.headless ?? false,
    });

    // attach() already applies the directory for research agents; re-apply for safety.
    this.applyWorkingDirectory(agent);

    agent.handleInput({
      from: "Research",
      message: `/deep research ${trimmed}`,
    });

    return {
      agentId: agent.id,
      researchDirectory,
    };
  }

  /**
   * List immediate subdirectories of the research root (past research projects).
   */
  listResearchProjects(): ResearchProjectSummary[] {
    const root = this.resolveResearchDirectory();
    if (!fs.existsSync(root)) {
      return [];
    }

    const entries = fs.readdirSync(root, { withFileTypes: true });
    const projects: ResearchProjectSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const fullPath = path.join(root, entry.name);
      const stat = fs.statSync(fullPath);
      projects.push({
        name: entry.name,
        path: fullPath,
        modifiedAt: stat.mtimeMs,
      });
    }

    return projects.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
}
