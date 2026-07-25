import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ResearchService from "./ResearchService.ts";

describe("ResearchService", () => {
  const tempDirs: string[] = [];

  function tempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function makeService(researchDirectory: string): ResearchService {
    return new ResearchService({ agentDefaults: { researchDirectory } });
  }

  test("listTopics returns an empty array when the directory doesn't exist", async () => {
    const service = makeService(path.join(tempDir(), "missing"));
    expect(await service.listTopics(service.getDefaultResearchDirectory())).toEqual([]);
  });

  test("createTopic creates an empty topic directory", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    const topic = await service.createTopic(dir, "solid-state-batteries");
    expect(topic).toMatchObject({ name: "solid-state-batteries", itemCount: 0 });
    expect(fs.existsSync(path.join(dir, "solid-state-batteries"))).toBe(true);
  });

  test("createTopic throws when the topic already exists", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createTopic(dir, "dup");
    await expect(service.createTopic(dir, "dup")).rejects.toThrow('Topic "dup" already exists');
  });

  test("createItem auto-creates its topic and getItem reads it back", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    const created = await service.createItem(dir, "batteries", "summary", "# Summary\n\nFindings...");
    expect(created).toMatchObject({ topicName: "batteries", name: "summary", content: "# Summary\n\nFindings..." });
    expect(fs.existsSync(path.join(dir, "batteries", "summary.md"))).toBe(true);

    const fetched = await service.getItem(dir, "batteries", "summary");
    expect(fetched?.content).toBe("# Summary\n\nFindings...");
  });

  test("createItem throws when the item already exists", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "notes", "one");
    await expect(service.createItem(dir, "topic", "notes", "two")).rejects.toThrow('Item "notes" already exists in topic "topic"');
  });

  test("updateItem overwrites existing content and creates missing items", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "page", "v1");
    const updated = await service.updateItem(dir, "topic", "page", "v2");
    expect(updated.content).toBe("v2");
    expect((await service.getItem(dir, "topic", "page"))?.content).toBe("v2");
  });

  test("deleteItem removes an existing item and reports missing ones", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "temp", "content");
    expect(await service.deleteItem(dir, "topic", "temp")).toBe(true);
    expect(await service.getItem(dir, "topic", "temp")).toBeNull();
    expect(await service.deleteItem(dir, "topic", "temp")).toBe(false);
  });

  test("deleteTopic removes a topic and all of its items", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "a", "a");
    await service.createItem(dir, "topic", "b", "b");
    expect(await service.deleteTopic(dir, "topic")).toBe(true);
    expect(fs.existsSync(path.join(dir, "topic"))).toBe(false);
    expect(await service.deleteTopic(dir, "topic")).toBe(false);
  });

  test("listTopics reports item counts, listItems only includes .md files sorted by name", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "b-notes", "b");
    await service.createItem(dir, "topic", "a-notes", "a");
    fs.writeFileSync(path.join(dir, "topic", "notes.txt"), "not a research item");

    const topics = await service.listTopics(dir);
    expect(topics).toEqual([expect.objectContaining({ name: "topic", itemCount: 2 })]);

    const items = await service.listItems(dir, "topic");
    expect(items.map(i => i.name)).toEqual(["a-notes", "b-notes"]);
  });

  test("rejects invalid topic and item names", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await expect(service.createTopic(dir, "../escape")).rejects.toThrow("Invalid topic name");
    await expect(service.createItem(dir, "topic", "has space", "x")).rejects.toThrow("Invalid item name");
  });
});
