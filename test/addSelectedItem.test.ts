import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BeforeInputReceived } from "@tokenring-ai/agent";
import type Agent from "@tokenring-ai/agent/Agent";
import addSelectedItem from "../hooks/addSelectedItem.ts";
import ResearchService from "../ResearchService.ts";
import { ResearchServiceConfigSchema } from "../schema.ts";
import { ResearchState } from "../state/ResearchState.ts";

/** Just enough of an Agent for the hook: one ResearchState slice and the service lookup. */
function fakeAgent(service: ResearchService, directory: string): Agent {
  const state = new ResearchState({ researchDirectory: directory });
  return {
    getState: () => state,
    mutateState: (_slice: unknown, fn: (s: ResearchState) => void) => fn(state),
    requireService: () => service,
  } as unknown as Agent;
}

async function runHook(agent: Agent) {
  const event = new BeforeInputReceived({ from: "test", message: "hi" } as ConstructorParameters<typeof BeforeInputReceived>[0]);
  for (const callback of addSelectedItem.callbacks) await callback.callback(event, agent);
  return event.input.attachments ?? [];
}

describe("addSelectedItem hook", () => {
  const tempDirs: string[] = [];
  afterEach(() => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
    tempDirs.length = 0;
  });

  test("attaches the selected dossier once, then again with its latest content after it changes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-hook-"));
    tempDirs.push(dir);
    const service = new ResearchService(ResearchServiceConfigSchema.parse({ agentDefaults: { researchDirectory: dir } }));
    const agent = fakeAgent(service, dir);

    await service.createItem(dir, "topic", "page", "v1");
    await service.selectItem("topic", "page", agent);

    const first = await runHook(agent);
    expect(first.map(a => a.body)).toEqual(["v1"]);
    // Unchanged: not attached again.
    expect(await runHook(agent)).toEqual([]);

    // Edited after selection (the selection itself still holds "v1").
    await service.updateItem(dir, "topic", "page", "v2");
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(path.join(dir, "topic", "page.md"), future, future);

    const second = await runHook(agent);
    expect(second.map(a => a.body)).toEqual(["v2"]);
    expect(second[0]?.description).toContain("updated version");
    expect(await runHook(agent)).toEqual([]);
  });
});
