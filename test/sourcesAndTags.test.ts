import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Agent from "@tokenring-ai/agent/Agent";
import { emitItemText, parseItemText } from "../itemFile.ts";
import ResearchService from "../ResearchService.ts";
import { ResearchServiceConfigSchema } from "../schema.ts";
import { buildBrief, normalizeSources } from "../sources.ts";
import { ResearchState } from "../state/ResearchState.ts";
import { filterTopicsByTags, matchTopics, normalizeTags, parseTagInput } from "../tags.ts";
import setTopicTags from "../tools/setTopicTags.ts";
import writeItem from "../tools/writeItem.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tr-research-src-"));
  tempDirs.push(dir);
  const service = new ResearchService(ResearchServiceConfigSchema.parse({ agentDefaults: { researchDirectory: dir } }));
  const state = new ResearchState({ researchDirectory: dir });
  const agent = { getState: () => state, requireService: () => service } as unknown as Agent;
  return { dir, service, agent };
}

const ACME = { url: "https://acme.example/report", title: "Annual report", publisher: "ACME Corp", accessed: "2026-11-01" };

describe("frontmatter", () => {
  test("emit then parse round-trips, and the file has the documented shape", () => {
    const text = emitItemText("# Body\n\ntext\n", [ACME, { url: "https://b.example/x", accessed: "2026-11-16" }]);
    expect(text).toBe(
      "---\nsources:\n  - url: https://acme.example/report\n    title: Annual report\n    publisher: ACME Corp\n    accessed: 2026-11-01\n  - url: https://b.example/x\n    accessed: 2026-11-16\n---\n# Body\n\ntext\n",
    );
    expect(parseItemText(text)).toEqual({ body: "# Body\n\ntext\n", sources: [ACME, { url: "https://b.example/x", accessed: "2026-11-16" }] });
  });

  test("text without frontmatter is untouched by parse and emit", () => {
    for (const text of ["# Plain\n\nbody", "", "---\n\nhorizontal rule start\n\n---\nmore", "---\nnot closed"]) {
      expect(parseItemText(text)).toEqual({ body: text, sources: [] });
      expect(emitItemText(text, [])).toBe(text);
    }
  });

  test("malformed frontmatter yields the raw text and a warning instead of throwing", () => {
    for (const raw of ["---\nsources: [unclosed\n---\n# Body", "---\nsources:\n  - url: javascript:alert(1)\n---\n# Body", "---\nsources: nope\n---\nx"]) {
      const parsed = parseItemText(raw);
      expect(parsed.body).toBe(raw);
      expect(parsed.sources).toEqual([]);
      expect(parsed.warning).toContain("showing the raw text");
    }
  });
});

describe("source validation", () => {
  test("only http(s) URLs are accepted", () => {
    expect(() => normalizeSources([{ url: "ftp://x.example/f" }])).toThrow();
    expect(() => normalizeSources([{ url: "not a url" }])).toThrow();
    expect(() => normalizeSources([{ url: "https://ok.example", accessed: "yesterday" }])).toThrow();
    expect(normalizeSources([{ url: "http://ok.example" }], "2026-11-16")).toEqual([{ url: "http://ok.example", accessed: "2026-11-16" }]);
  });

  test("repeated URLs inside one item collapse, keeping the first", () => {
    const out = normalizeSources(
      [
        { url: "https://a.example/p", title: "First" },
        { url: "https://a.example/p", title: "Second" },
      ],
      "2026-11-16",
    );
    expect(out).toEqual([{ url: "https://a.example/p", title: "First", accessed: "2026-11-16" }]);
  });
});

describe("ResearchService items with sources", () => {
  test("write with sources, read back separately, list shows count, search ignores frontmatter", async () => {
    const { dir, service } = setup();
    await service.updateItem(dir, "acme", "profile", "# Profile\n\nRevenue grew.", { sources: [ACME] });
    const raw = fs.readFileSync(path.join(dir, "acme", "profile.md"), "utf-8");
    expect(raw.startsWith("---\nsources:\n")).toBe(true);

    const item = await service.getItem(dir, "acme", "profile");
    expect(item?.content).toBe("# Profile\n\nRevenue grew.");
    expect(item?.sources).toEqual([ACME]);
    expect((await service.listItems(dir, "acme"))[0]?.sourceCount).toBe(1);
    expect(await service.searchItems(dir, "acme.example")).toEqual([]);
    expect((await service.searchItems(dir, "revenue"))[0]?.name).toBe("profile");
  });

  test("writing without sources keeps existing ones; [] clears them; plain files stay byte-identical", async () => {
    const { dir, service } = setup();
    await service.updateItem(dir, "t", "i", "v1", { sources: [ACME] });
    await service.updateItem(dir, "t", "i", "v2");
    expect((await service.getItem(dir, "t", "i"))?.sources).toEqual([ACME]);
    await service.updateItem(dir, "t", "i", "v3", { sources: [] });
    expect(fs.readFileSync(path.join(dir, "t", "i.md"), "utf-8")).toBe("v3");

    fs.writeFileSync(path.join(dir, "t", "legacy.md"), "# Legacy\n");
    expect((await service.getItem(dir, "t", "legacy"))?.sources).toEqual([]);
    await service.updateItem(dir, "t", "legacy", "# Legacy\n\nedited\n");
    expect(fs.readFileSync(path.join(dir, "t", "legacy.md"), "utf-8")).toBe("# Legacy\n\nedited\n");
  });

  test("a malformed block does not break reading, and saving the raw text rewrites it unchanged", async () => {
    const { dir, service } = setup();
    fs.mkdirSync(path.join(dir, "t"));
    const raw = "---\nsources: [oops\n---\n# Body";
    fs.writeFileSync(path.join(dir, "t", "bad.md"), raw);
    const item = await service.getItem(dir, "t", "bad");
    expect(item?.content).toBe(raw);
    expect(item?.warning).toBeDefined();
    await service.updateItem(dir, "t", "bad", item?.content ?? "");
    expect(fs.readFileSync(path.join(dir, "t", "bad.md"), "utf-8")).toBe(raw);
  });

  test("renameItem moves the file with its sources", async () => {
    const { dir, service } = setup();
    await service.updateItem(dir, "a", "x", "body", { sources: [ACME] });
    const moved = await service.renameItem(dir, "a", "x", "b", "y");
    expect(moved.sources).toEqual([ACME]);
  });

  test("item_write tool passes sources through and rejects non-http URLs", async () => {
    const { dir, service, agent } = setup();
    const input = writeItem.inputSchema;
    expect(input.safeParse({ topicName: "t", name: "i", content: "x", sources: [{ url: "file:///etc/passwd" }] }).success).toBe(false);
    const parsed = input.parse({ topicName: "t", name: "i", content: "x", sources: [{ url: "https://a.example", title: "A" }] });
    await writeItem.execute(parsed, agent);
    expect((await service.getItem(dir, "t", "i"))?.sources[0]).toMatchObject({ url: "https://a.example", title: "A" });
  });
});

describe("tags", () => {
  test("normalisation trims, lowercases, de-duplicates and caps", () => {
    expect(normalizeTags(["  ACME ", "acme", "Q4  Review", "", "x".repeat(50)])).toEqual(["acme", "q4 review", "x".repeat(32)]);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(10);
    expect(parseTagInput("ACME, q4\nacme,  ")).toEqual(["acme", "q4"]);
  });

  test("filter requires every active tag; matchTopics searches names and tags", () => {
    const topics = [
      { name: "alpha", tags: ["acme", "q4"] },
      { name: "beta", tags: ["acme"] },
      { name: "gamma", tags: [] },
    ];
    expect(filterTopicsByTags(topics, []).map(t => t.name)).toEqual(["alpha", "beta", "gamma"]);
    expect(filterTopicsByTags(topics, ["acme"]).map(t => t.name)).toEqual(["alpha", "beta"]);
    expect(filterTopicsByTags(topics, ["acme", "q4"]).map(t => t.name)).toEqual(["alpha"]);
    expect(matchTopics(topics, "ACM").map(t => t.name)).toEqual(["alpha", "beta"]);
    expect(matchTopics(topics, "gam").map(t => t.name)).toEqual(["gamma"]);
  });

  test("sidecar file holds tags, shows in listTopics, is removed when cleared, and is not an item", async () => {
    const { dir, service } = setup();
    await service.createTopic(dir, "acme-review");
    const topic = await service.setTopicTags(dir, "acme-review", [" ACME ", "acme", "Due Diligence"]);
    expect(topic.tags).toEqual(["acme", "due diligence"]);
    expect(fs.readFileSync(path.join(dir, "acme-review", ".topic.yaml"), "utf-8")).toBe("tags:\n  - acme\n  - due diligence\n");
    expect((await service.listTopics(dir))[0]).toMatchObject({ itemCount: 0, tags: ["acme", "due diligence"] });
    await service.setTopicTags(dir, "acme-review", []);
    expect(fs.existsSync(path.join(dir, "acme-review", ".topic.yaml"))).toBe(false);
    await expect(service.setTopicTags(dir, "missing", ["x"])).rejects.toThrow("not found");
  });

  test("an unreadable sidecar means untagged", async () => {
    const { dir, service } = setup();
    await service.createTopic(dir, "t");
    fs.writeFileSync(path.join(dir, "t", ".topic.yaml"), "tags: [broken");
    expect((await service.listTopics(dir))[0]?.tags).toEqual([]);
  });

  test("topic_setTags tool normalises and stores", async () => {
    const { dir, service, agent } = setup();
    await service.createTopic(dir, "t");
    const result = await setTopicTags.execute(setTopicTags.inputSchema.parse({ topicName: "t", tags: ["ACME", "acme"] }), agent);
    expect(JSON.parse(String((result as { result: string }).result))).toEqual({ topicName: "t", tags: ["acme"] });
    expect((await service.listTopics(dir))[0]?.tags).toEqual(["acme"]);
  });
});

describe("brief export", () => {
  test("buildBrief golden output: pointer lines, numbered de-duplicated references, untouched item text", () => {
    const { content, sourceCount } = buildBrief(
      "acme-review",
      ["acme"],
      [
        {
          name: "profile",
          content: "# Profile\n\nSee https://acme.example/report inline.",
          sources: [ACME, { url: "https://b.example/x", accessed: "2026-11-16" }],
        },
        {
          name: "risks",
          content: "# Risks",
          sources: [{ url: "https://acme.example/report", title: "Different title", accessed: "2026-11-10" }, { url: "https://c.example/" }],
        },
        { name: "notes", content: "No sources here", sources: [] },
      ],
      "2026-11-16T00:00:00.000Z",
    );
    expect(sourceCount).toBe(3);
    expect(content).toBe(
      [
        "# acme-review",
        "",
        "_Exported 2026-11-16T00:00:00.000Z · Tags: acme · 3 dossiers_",
        "",
        "---",
        "",
        "## profile",
        "",
        "# Profile",
        "",
        "See https://acme.example/report inline.",
        "",
        "_Sources: [1], [2]_",
        "",
        "---",
        "",
        "## risks",
        "",
        "# Risks",
        "",
        "_Sources: [1], [3]_",
        "",
        "---",
        "",
        "## notes",
        "",
        "No sources here",
        "",
        "---",
        "",
        "## References",
        "",
        "1. Annual report — ACME Corp. <https://acme.example/report> (accessed 2026-11-01)",
        "2. b.example. <https://b.example/x> (accessed 2026-11-16)",
        "3. c.example. <https://c.example/>",
        "",
      ].join("\n"),
    );
  });

  test("a topic without sources gets no References section", async () => {
    const { dir, service } = setup();
    await service.createItem(dir, "t", "a", "# A");
    const brief = await service.exportBrief(dir, "t", "2026-11-16T00:00:00.000Z");
    expect(brief).toMatchObject({ fileName: "t-brief.md", itemCount: 1, sourceCount: 0 });
    expect(brief.content).not.toContain("References");
  });

  test("exportBrief and exportTopic leave frontmatter out of the text", async () => {
    const { dir, service } = setup();
    await service.updateItem(dir, "t", "a", "# A", { sources: [ACME] });
    const brief = await service.exportBrief(dir, "t");
    expect(brief.content).toContain("1. Annual report — ACME Corp.");
    expect(brief.content).not.toContain("sources:");
    expect((await service.exportTopic(dir, "t")).content).not.toContain("sources:");
    await expect(service.exportBrief(dir, "nope")).rejects.toThrow("not found");
  });
});
