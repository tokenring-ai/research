import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type TokenRingApp from "@tokenring-ai/app";
import ResearchService from "./ResearchService.ts";

describe("ResearchService", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("resolveResearchDirectory resolves relative paths against projectDirectory", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-proj-"));
    tempDirs.push(project);
    const service = new ResearchService({} as TokenRingApp, { researchDirectory: ".tokenring/research" }, project);
    expect(service.resolveResearchDirectory()).toBe(path.join(project, ".tokenring/research"));
  });

  test("ensureResearchDirectory creates the directory", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-proj-"));
    tempDirs.push(project);
    const service = new ResearchService({} as TokenRingApp, { researchDirectory: "research-out" }, project);
    const dir = service.ensureResearchDirectory();
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toBe(path.join(project, "research-out"));
  });

  test("listResearchProjects returns subdirectories sorted by mtime", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-proj-"));
    tempDirs.push(project);
    const root = path.join(project, "research");
    fs.mkdirSync(path.join(root, "older"), { recursive: true });
    fs.mkdirSync(path.join(root, "newer"), { recursive: true });
    // Touch newer more recently
    const newerPath = path.join(root, "newer");
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(path.join(root, "older"), past, past);
    fs.utimesSync(newerPath, new Date(), new Date());

    const service = new ResearchService({} as TokenRingApp, { researchDirectory: root }, project);
    const projects = service.listResearchProjects();
    expect(projects.map(p => p.name)).toEqual(["newer", "older"]);
  });

  test("startResearch rejects empty query", () => {
    const service = new ResearchService({} as TokenRingApp, { researchDirectory: "/tmp" }, "/tmp");
    expect(() => service.startResearch("   ")).toThrow("Research query must not be empty");
  });
});
