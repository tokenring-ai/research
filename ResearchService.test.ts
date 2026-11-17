import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ResearchService from "./ResearchService.ts";
import { ResearchServiceConfigSchema } from "./schema.ts";

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
    return new ResearchService(ResearchServiceConfigSchema.parse({ agentDefaults: { researchDirectory } }));
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

  test("updateItem with requireExisting refuses to re-create an item deleted elsewhere", async () => {
    const dir = tempDir();
    const service = makeService(dir);

    await service.createItem(dir, "topic", "page", "v1");
    expect((await service.updateItem(dir, "topic", "page", "v2", { requireExisting: true })).content).toBe("v2");

    await service.deleteItem(dir, "topic", "page");
    await expect(service.updateItem(dir, "topic", "page", "v3", { requireExisting: true })).rejects.toThrow('Item "page" no longer exists in topic "topic"');
    expect(await service.getItem(dir, "topic", "page")).toBeNull();
  });

  test("a sources save based on stale sources is refused and nothing is overwritten", async () => {
    const dir = tempDir();
    const service = makeService(dir);
    const a = { url: "https://a.example/x", title: "A" };
    const b = { url: "https://b.example/y", title: "B" };
    const created = await service.createItem(dir, "topic", "page", "body", [a]);

    // The editor loaded [a]; meanwhile an agent adds b.
    await service.updateItem(dir, "topic", "page", "body", { sources: [a, b] });
    await expect(service.updateItem(dir, "topic", "page", "body", { sources: [{ ...a, title: "A2" }], expectedSources: created.sources })).rejects.toThrow(
      "changed elsewhere",
    );
    expect((await service.getItem(dir, "topic", "page"))?.sources.map(source => source.url)).toEqual([a.url, b.url]);

    // Based on what is really there, the save goes through.
    const current = (await service.getItem(dir, "topic", "page"))?.sources ?? [];
    const saved = await service.updateItem(dir, "topic", "page", "body", { sources: [current[0] as (typeof current)[0]], expectedSources: current });
    expect(saved.sources.map(source => source.url)).toEqual([a.url]);
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

  test("renameItem moves a dossier within and across topics, creating the target topic", async () => {
    const dir = tempDir();
    const service = makeService(dir);
    await service.createItem(dir, "a", "notes", "# Notes\nbody");

    const renamed = await service.renameItem(dir, "a", "notes", "a", "summary");
    expect(renamed).toMatchObject({ topicName: "a", name: "summary", content: "# Notes\nbody" });
    expect(await service.getItem(dir, "a", "notes")).toBeNull();

    const moved = await service.renameItem(dir, "a", "summary", "b", "summary");
    expect(moved.topicName).toBe("b");
    expect(fs.existsSync(path.join(dir, "b", "summary.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "a", "summary.md"))).toBe(false);
  });

  test("renameItem refuses to overwrite and reports a missing source", async () => {
    const dir = tempDir();
    const service = makeService(dir);
    await service.createItem(dir, "a", "one", "1");
    await service.createItem(dir, "a", "two", "2");

    await expect(service.renameItem(dir, "a", "one", "a", "two")).rejects.toThrow('Item "two" already exists in topic "a"');
    await expect(service.renameItem(dir, "a", "ghost", "a", "three")).rejects.toThrow('Item "ghost" not found');
    await expect(service.renameItem(dir, "a", "one", "a", "../escape")).rejects.toThrow("Invalid item name");
    expect((await service.getItem(dir, "a", "two"))?.content).toBe("2");
  });

  test("searchItems matches names, titles and content case-insensitively with snippets", async () => {
    const dir = tempDir();
    const service = makeService(dir);
    await service.createItem(dir, "batteries", "overview", "# Solid-State Overview\nIntro text.");
    await service.createItem(dir, "batteries", "market", `# Market\n${"x".repeat(200)} lithium supply LITHIUM prices ${"y".repeat(200)}`);
    await service.createItem(dir, "solar", "panels", "# Panels\nNothing relevant.");

    const results = await service.searchItems(dir, "Lithium");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ topicName: "batteries", name: "market", title: "Market", titleMatch: false, contentMatches: 2 });
    expect(results[0]?.snippet.startsWith("…")).toBe(true);
    expect(results[0]?.snippet.endsWith("…")).toBe(true);
    expect(results[0]?.snippet.toLowerCase()).toContain("lithium supply");

    const byTitle = await service.searchItems(dir, "solid-state");
    expect(byTitle[0]).toMatchObject({ name: "overview", titleMatch: true });

    expect(await service.searchItems(dir, "panels", { topicName: "batteries" })).toEqual([]);
    expect(await service.searchItems(dir, "   ")).toEqual([]);
    expect(await service.searchItems(dir, "e", { limit: 2 })).toHaveLength(2);
  });

  test("exportTopic concatenates every dossier into one Markdown document", async () => {
    const dir = tempDir();
    const service = makeService(dir);
    await service.createItem(dir, "t", "alpha", "# Alpha\nA body");
    await service.createItem(dir, "t", "beta", "B body");

    const exported = await service.exportTopic(dir, "t");
    expect(exported.fileName).toBe("t.md");
    expect(exported.itemCount).toBe(2);
    expect(exported.content.startsWith("# t\n")).toBe(true);
    expect(exported.content.indexOf("## alpha")).toBeLessThan(exported.content.indexOf("## beta"));
    expect(exported.content).toContain("A body");
    await expect(service.exportTopic(dir, "missing")).rejects.toThrow('Topic "missing" not found');
  });
});
