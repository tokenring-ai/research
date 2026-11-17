import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defineView } from "@tokenring-ai/one-frontend/layout/define.ts";
import { MessageSquare } from "lucide-react";
import type React from "react";

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

// Monaco is a heavy browser widget; a textarea stands in for it.
void mock.module("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string | undefined) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={e => onChange?.(e.target.value)} />
  ),
}));

void mock.module("@tokenring-ai/one-frontend/hooks/useTheme.ts", () => ({ useTheme: () => ["dark", mock()] as const }));

const topics = [
  { name: "solid-state-batteries", itemCount: 2, updatedAt: "2026-07-01T12:00:00.000Z", tags: ["acme", "q4"] },
  { name: "local-ai-tools", itemCount: 0, updatedAt: "2026-07-01T11:00:00.000Z", tags: [] },
];

const batteryItems = [
  { topicName: "solid-state-batteries", name: "summary", size: 420, updatedAt: "2026-07-01T12:00:00.000Z", sourceCount: 2 },
  { topicName: "solid-state-batteries", name: "toc", size: 180, updatedAt: "2026-07-01T12:01:00.000Z", sourceCount: 0 },
];

const summaryItem = {
  topicName: "solid-state-batteries",
  name: "summary",
  content: "# Summary\n\nSolid-state batteries are promising.",
  size: 420,
  updatedAt: "2026-07-01T12:00:00.000Z",
  sourceCount: 2,
  sources: [
    { url: "https://acme.example/report", title: "Annual report", publisher: "ACME Corp", accessed: "2026-11-01" },
    { url: "https://news.example/story", accessed: "2026-11-02" },
  ] as { url: string; title?: string; publisher?: string; accessed?: string }[],
  warning: undefined as string | undefined,
};

let topicsState = [...topics];
let itemsByTopic: Record<string, typeof batteryItems> = {};
let getItemResult: typeof summaryItem | null = summaryItem;
let configurationState: { agentTypes: string[]; searchProviderAvailable: boolean } = { agentTypes: ["research"], searchProviderAvailable: true };

const createAgent = mock(async (_args: { agentType: string }) => ({ id: "research-agent-1", displayName: "Researcher", description: "" }));
const sendInput = mock(async () => ({ status: "success" as const, requestId: "req-1" }));
const deleteAgent = mock(async () => ({ status: "success" as const }));
const createTopic = mock(async (_args: { name: string }) => ({ topic: { name: _args.name, itemCount: 0, updatedAt: "2026-07-02T00:00:00.000Z", tags: [] } }));
const deleteTopic = mock(async (_args: { name: string }) => ({ success: true }));
const createItem = mock(async (args: { topicName: string; name: string; content: string; sources?: unknown[] }) => ({
  item: {
    topicName: args.topicName,
    name: args.name,
    content: args.content,
    size: args.content.length,
    updatedAt: "2026-07-02T00:00:00.000Z",
    sourceCount: 0,
    sources: [],
  },
}));
type TestSource = { url: string; title?: string; publisher?: string; accessed?: string };
const updateItem = mock(async (args: { topicName: string; name: string; content: string; sources?: TestSource[]; baseSources?: TestSource[] }) => ({
  item: {
    topicName: args.topicName,
    name: args.name,
    content: args.content,
    size: args.content.length,
    updatedAt: "2026-07-02T00:00:00.000Z",
    sourceCount: args.sources?.length ?? 0,
    sources: args.sources ?? [],
  },
}));
const deleteItem = mock(async (_args: { topicName: string; name: string }) => ({ success: true }));
const getItem = mock(async (_args: { topicName: string; name: string }) => ({ item: getItemResult }));
const renameItem = mock(async (args: { topicName: string; name: string; newTopicName: string; newName: string }) => ({
  item: { ...summaryItem, topicName: args.newTopicName, name: args.newName },
}));
const searchItems = mock(async (_args: { query: string }) => ({
  results: [
    {
      topicName: "solid-state-batteries",
      name: "summary",
      title: "Summary",
      titleMatch: false,
      contentMatches: 2,
      snippet: "…batteries are promising…",
      updatedAt: "2026-07-01T12:00:00.000Z",
    },
  ],
}));
const exportBrief = mock(async (args: { topicName: string; format?: "md" | "docx" | "pdf" }) =>
  args.format === "docx" || args.format === "pdf"
    ? {
        fileName: `${args.topicName}-brief.${args.format}`,
        mimeType: `application/${args.format}`,
        contentBase64: "UEs=",
        itemCount: 2,
        sourceCount: 3,
        warnings: exportWarnings,
      }
    : { fileName: `${args.topicName}-brief.md`, content: "# brief", itemCount: 2, sourceCount: 3 },
);
let exportWarnings: string[] = [];
const downloadBase64File = mock((_fileName: string, _mime: string, _base64: string) => {});
void mock.module("../lib/download.ts", () => ({ downloadBase64File }));
const setTopicTags = mock(async (args: { name: string; tags: string[] }) => ({
  topic: { name: args.name, itemCount: 2, updatedAt: "2026-07-02T00:00:00.000Z", tags: args.tags },
}));
const exportTopic = mock(async (args: { topicName: string }) => ({ fileName: `${args.topicName}.md`, content: "# topic", itemCount: 2 }));
const downloadTextFile = mock((_fileName: string, _content: string, _mime: string) => {});
let todosState: { status: "success"; todos: { id: string; content: string; status: "pending" | "in_progress" | "completed" | "cancelled" }[] } | undefined;
void mock.module("@tokenring-ai/one-frontend/lib/transcriptExport.ts", () => ({ downloadTextFile }));

const updateResearchState = mock(async () => ({ status: "success" as const, selectedTopicName: null, selectedItemName: null }));

void mock.module("@tokenring-ai/one-frontend/rpc.ts", () => ({
  useTopics: () => ({ data: { topics: topicsState }, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useItems: (topicName: string | null) => ({
    data: topicName ? { items: itemsByTopic[topicName] ?? [] } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useResearchConfiguration: () => ({ data: configurationState, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useTodos: (agentId: string | undefined) => ({ data: agentId ? todosState : undefined, isLoading: false, error: undefined }),
  useAgentList: () => ({ data: [], isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useAgentTypes: () => ({
    data: [{ type: "research", displayName: "Researcher", description: "Deep research", category: "Research", enabledTools: [] }],
    isLoading: false,
  }),
  agentRPCClient: { createAgent, sendInput, deleteAgent },
  researchRPCClient: {
    getResearchConfiguration: mock(async () => ({ agentTypes: ["research"] })),
    createTopic,
    deleteTopic,
    createItem,
    updateItem,
    deleteItem,
    getItem,
    updateResearchState,
    renameItem,
    searchItems,
    exportTopic,
    exportBrief,
    setTopicTags,
  },
}));

const { notificationManager } = await import("@tokenring-ai/one-frontend/components/ui/toast.tsx");
const toastWarning = spyOn(notificationManager, "warning");
const toastSuccess = spyOn(notificationManager, "success");
const toastError = spyOn(notificationManager, "error");
const { default: layout } = await import("../layout.ts");
const { default: viewsModule } = await import("../views.tsx");
const { CORE_KINDS } = await import("@tokenring-ai/one-frontend/apps/kinds.ts");
const { createLayoutRegistry } = await import("@tokenring-ai/one-frontend/layout/registry.ts");
const { renderLayoutApp } = await import("@tokenring-ai/one-frontend/test/layout.tsx");
const { clearItemDrafts, getItemDraft, resetResearchAgentSession, setItemDraft } = await import("../lib/researchStore.ts");

function ChatStub() {
  return <p>chat stub</p>;
}

const chatView = defineView({
  id: "chat",
  kind: "agent",
  title: params => params.agentId ?? "Chat",
  icon: MessageSquare,
  route: "agent/:agentId",
  instanceKey: params => params.agentId ?? "",
  component: ChatStub,
});

const registry = createLayoutRegistry({ apps: layout.apps, views: [...viewsModule.views, chatView], kinds: [...CORE_KINDS, ...layout.kinds] });

let current: ReturnType<typeof renderLayoutApp> | null = null;
const renderResearch = (url = "/research") => {
  current = renderLayoutApp({ registry, url });
  return current;
};
const pathname = () => current?.location().pathname;
const panelOpen = (key: string) => document.querySelector(`[data-panel="${key}"]`) !== null;
const ITEM_KEY = "research-item:solid-state-batteries/summary";
const hasUnsavedBadge = () => screen.queryAllByRole("img", { name: "Unsaved changes" }).length > 0;

describe("Research app", () => {
  beforeEach(() => {
    localStorage.clear();
    clearItemDrafts();
    resetResearchAgentSession();
    for (const fn of [
      createAgent,
      sendInput,
      deleteAgent,
      createTopic,
      deleteTopic,
      createItem,
      updateItem,
      deleteItem,
      getItem,
      updateResearchState,
      renameItem,
      searchItems,
      exportTopic,
      exportBrief,
      setTopicTags,
      downloadTextFile,
      downloadBase64File,
      toastWarning,
      toastSuccess,
      toastError,
    ]) {
      fn.mockClear();
    }
    topicsState = [...topics];
    itemsByTopic = { "solid-state-batteries": [...batteryItems], "local-ai-tools": [] };
    getItemResult = { ...summaryItem };
    configurationState = { agentTypes: ["research"], searchProviderAvailable: true };
    todosState = undefined;
    exportWarnings = [];
  });

  describe("layout", () => {
    it("keeps the old dashboard's identity and can host agent chats", () => {
      const app = layout.apps[0]!;
      expect(app).toMatchObject({ id: "research", path: "/research", label: "Research", group: "Build", shortLabel: "RE" });
      expect(app.views).toContain("chat");
      expect(registry.routes.resolve("/research")?.viewId).toBe("research-start");
      expect(registry.routes.resolve("/research/solid-state-batteries")?.viewId).toBe("research-topic");
      expect(registry.routes.resolve("/research/solid-state-batteries/summary")).toMatchObject({
        viewId: "research-item",
        params: { topicName: "solid-state-batteries", itemName: "summary" },
      });
    });

    it("shows the landing for a bare topic URL and expands that topic in the navigator", async () => {
      renderResearch("/research/solid-state-batteries");
      // The app's own landing tab opens beside the topic's, as in marketplace.
      await waitFor(() => expect(screen.getAllByText("Start researching").length).toBeGreaterThan(0));
      expect(await screen.findByText("toc")).toBeInTheDocument();
    });
  });

  describe("topics navigator", () => {
    it("lists topics and their items once a topic is expanded", async () => {
      const user = userEvent.setup();
      renderResearch();

      expect(await screen.findByText("solid-state-batteries")).toBeInTheDocument();
      expect(screen.getByText("local-ai-tools")).toBeInTheDocument();

      await user.click(screen.getByText("solid-state-batteries"));
      expect(await screen.findByText("summary")).toBeInTheDocument();
      expect(screen.getByText("toc")).toBeInTheDocument();
    });

    it("opens the dossier tab, navigates, and closes the landing when an item is picked", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByText("solid-state-batteries"));
      await user.click(await screen.findByText("summary"));

      expect(pathname()).toBe("/research/solid-state-batteries/summary");
      expect(await screen.findByText("Solid-state batteries are promising.")).toBeInTheDocument();
      expect(panelOpen(ITEM_KEY)).toBe(true);
      expect(panelOpen("research-start:_")).toBe(false);
      expect(screen.queryByText("Start researching")).not.toBeInTheDocument();
    });

    it("expands the topic named by the URL", async () => {
      renderResearch("/research/solid-state-batteries/summary");
      expect(await screen.findByText("toc")).toBeInTheDocument();
    });

    it("creates a new topic", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(screen.getByTitle("New topic"));
      await user.type(screen.getByPlaceholderText("solid-state-batteries"), "quantum-sensors");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(createTopic).toHaveBeenCalledWith({ name: "quantum-sensors" }));
    });

    it("creates a research item in a topic and opens it", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "New item in solid-state-batteries" }));
      const dialog = screen.getByRole("dialog");
      await user.type(within(dialog).getByPlaceholderText("summary"), "risks");
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ topicName: "solid-state-batteries", name: "risks" })));
      await waitFor(() => expect(pathname()).toBe("/research/solid-state-batteries/risks"));
    });

    it("deletes an item after confirmation, closing its tab and leaving its URL", async () => {
      const user = userEvent.setup();
      renderResearch("/research/solid-state-batteries/summary");
      await screen.findByText("Solid-state batteries are promising.");

      await user.click(await screen.findByRole("button", { name: "Delete item summary" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary" }));
      await waitFor(() => expect(panelOpen(ITEM_KEY)).toBe(false));
      await waitFor(() => expect(pathname()).toBe("/research"));
    });

    it("warns, with a link to configuration, when no web search provider is configured", async () => {
      const user = userEvent.setup();
      configurationState = { agentTypes: ["research"], searchProviderAvailable: false };
      renderResearch();

      expect(await screen.findByText("No web search provider")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Configure" }));
      await waitFor(() => expect(pathname()).toBe("/configuration"));
    });

    it("shows no search provider warning when one is configured", async () => {
      renderResearch();
      await screen.findByText("solid-state-batteries");
      expect(screen.queryByText("No web search provider")).not.toBeInTheDocument();
    });

    it("keeps the dossier's tab and draft when the delete fails", async () => {
      const user = userEvent.setup();
      deleteItem.mockImplementationOnce(async () => ({ success: false }));
      setItemDraft("solid-state-batteries/summary", "edited");
      renderResearch("/research/solid-state-batteries/summary");

      await user.click(await screen.findByRole("button", { name: "Delete item summary" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteItem).toHaveBeenCalled());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(panelOpen(ITEM_KEY)).toBe(true);
      expect(getItemDraft("solid-state-batteries/summary")).toBe("edited");
      expect(pathname()).toBe("/research/solid-state-batteries/summary");
    });

    it("keeps the topic's tabs open when the delete fails", async () => {
      const user = userEvent.setup();
      deleteTopic.mockImplementationOnce(async () => ({ success: false }));
      renderResearch("/research/solid-state-batteries/summary");

      await user.click(await screen.findByRole("button", { name: "Delete topic solid-state-batteries" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteTopic).toHaveBeenCalled());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(panelOpen(ITEM_KEY)).toBe(true);
    });

    it("deletes a topic after confirmation", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Delete topic local-ai-tools" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteTopic).toHaveBeenCalledWith({ name: "local-ai-tools" }));
    });

    it("deleting a topic closes every open dossier in it and drops their drafts", async () => {
      const user = userEvent.setup();
      renderResearch("/research/local-ai-tools/ollama");
      await waitFor(() => expect(panelOpen("research-item:local-ai-tools/ollama")).toBe(true));
      current!.go("/research/solid-state-batteries/summary");
      current!.go("/research/solid-state-batteries/toc");
      await waitFor(() => expect(panelOpen("research-item:solid-state-batteries/summary")).toBe(true));
      await waitFor(() => expect(panelOpen("research-item:solid-state-batteries/toc")).toBe(true));
      setItemDraft("solid-state-batteries/summary", "edited");
      setItemDraft("solid-state-batteries/toc", "edited too");
      setItemDraft("local-ai-tools/ollama", "kept");

      await user.click(await screen.findByRole("button", { name: "Delete topic solid-state-batteries" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteTopic).toHaveBeenCalledWith({ name: "solid-state-batteries" }));
      await waitFor(() => expect(panelOpen("research-item:solid-state-batteries/summary")).toBe(false));
      expect(panelOpen("research-item:solid-state-batteries/toc")).toBe(false);
      expect(getItemDraft("solid-state-batteries/summary")).toBeNull();
      expect(getItemDraft("solid-state-batteries/toc")).toBeNull();
      // Another topic's dossier is untouched.
      expect(getItemDraft("local-ai-tools/ollama")).toBe("kept");
      expect(panelOpen("research-item:local-ai-tools/ollama")).toBe(true);
      await waitFor(() => expect(pathname()).toBe("/research"));
    });
  });

  describe("navigator search, export and progress", () => {
    it("searches across topics and opens a result", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.type(screen.getByLabelText("Search research"), "promising");
      const results = await screen.findByRole("list", { name: "Search results" });
      await waitFor(() => expect(searchItems).toHaveBeenLastCalledWith({ query: "promising" }));
      expect(within(results).getByText("…batteries are promising…")).toBeInTheDocument();
      expect(within(results).getByText("2 matches")).toBeInTheDocument();
      // The topic tree is replaced while searching.
      expect(screen.queryByText("local-ai-tools")).not.toBeInTheDocument();

      await user.click(within(results).getByRole("button", { name: /summary/ }));
      await waitFor(() => expect(pathname()).toBe("/research/solid-state-batteries/summary"));

      await user.clear(screen.getByLabelText("Search research"));
      expect(await screen.findByText("local-ai-tools")).toBeInTheDocument();
    });

    it("shows an empty state when nothing matches", async () => {
      const user = userEvent.setup();
      searchItems.mockImplementationOnce(async () => ({ results: [] }));
      renderResearch();

      await user.type(screen.getByLabelText("Search research"), "zzz");
      expect(await screen.findByText("No matching dossiers")).toBeInTheDocument();
    });

    it("exports a whole topic as Markdown", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export topic solid-state-batteries" }));
      await waitFor(() => expect(downloadTextFile).toHaveBeenCalledWith("solid-state-batteries.md", "# topic", "text/markdown"));
      expect(exportTopic).toHaveBeenCalledWith({ topicName: "solid-state-batteries" });
    });

    it("exports a client brief via exportBrief", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "Markdown (.md)" }));
      await waitFor(() => expect(downloadTextFile).toHaveBeenCalledWith("solid-state-batteries-brief.md", "# brief", "text/markdown"));
      expect(exportBrief).toHaveBeenCalledWith({ topicName: "solid-state-batteries", format: "md" });
    });

    it("exports a Word or PDF brief by downloading the base64 file", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "Word (.docx)" }));
      await waitFor(() => expect(downloadBase64File).toHaveBeenCalledWith("solid-state-batteries-brief.docx", "application/docx", "UEs="));
      expect(exportBrief).toHaveBeenCalledWith({ topicName: "solid-state-batteries", format: "docx" });

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "PDF (.pdf)" }));
      await waitFor(() => expect(downloadBase64File).toHaveBeenCalledWith("solid-state-batteries-brief.pdf", "application/pdf", "UEs="));
    });

    it("shows the export warnings", async () => {
      exportWarnings = ["3 characters were replaced with ?."];
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "PDF (.pdf)" }));
      await waitFor(() => expect(toastWarning).toHaveBeenCalledWith("3 characters were replaced with ?.", { duration: 10000 }));
    });

    it("copies the brief as Markdown to the clipboard", async () => {
      const user = userEvent.setup(); // installs a clipboard stub
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "Copy Markdown" }));
      await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("# brief"));
      expect(downloadTextFile).not.toHaveBeenCalled();
    });

    it("shows an error toast when the export fails", async () => {
      exportBrief.mockImplementationOnce(async () => {
        throw new Error("render exploded");
      });
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Export brief for solid-state-batteries" }));
      await user.click(await screen.findByRole("menuitem", { name: "PDF (.pdf)" }));
      await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringContaining("render exploded"), { duration: 4000 }));
      expect(downloadBase64File).not.toHaveBeenCalled();
    });

    it("shows tags on topics and a source-count badge on item rows", async () => {
      const user = userEvent.setup();
      renderResearch();

      const tags = await screen.findByLabelText("Tags of solid-state-batteries");
      expect(within(tags).getByText("acme")).toBeInTheDocument();
      await user.click(screen.getByText("solid-state-batteries"));
      expect(await screen.findByRole("img", { name: "2 sources" })).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: /0 sources/ })).not.toBeInTheDocument();
    });

    it("edits a topic's tags through the tag editor", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.click(await screen.findByRole("button", { name: "Set tags for solid-state-batteries" }));
      const dialog = screen.getByRole("dialog");
      const input = within(dialog).getByPlaceholderText("acme, due-diligence");
      expect(input).toHaveValue("acme, q4");
      await user.clear(input);
      await user.type(input, "ACME, Board Pack");
      await user.click(within(dialog).getByRole("button", { name: "Save tags" }));

      await waitFor(() => expect(setTopicTags).toHaveBeenCalledWith({ name: "solid-state-batteries", tags: ["acme", "board pack"] }));
    });

    it("filters topics by tag chips and matches tags in the search box", async () => {
      const user = userEvent.setup();
      renderResearch();

      const filter = await screen.findByRole("group", { name: "Filter by tag" });
      expect(screen.getByText("local-ai-tools")).toBeInTheDocument();
      await user.click(within(filter).getByRole("button", { name: "q4" }));
      expect(screen.queryByText("local-ai-tools")).not.toBeInTheDocument();
      expect(screen.getByText("solid-state-batteries")).toBeInTheDocument();
      await user.click(within(filter).getByRole("button", { name: "q4" }));
      expect(screen.getByText("local-ai-tools")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Search research"), "acme");
      const matches = await screen.findByRole("group", { name: "Matching topics" });
      expect(within(matches).getByText("solid-state-batteries")).toBeInTheDocument();
      expect(within(matches).queryByText("local-ai-tools")).not.toBeInTheDocument();
    });

    it("shows the attached research agent's todos in the navigator and the landing tab", async () => {
      const user = userEvent.setup();
      todosState = { status: "success", todos: [{ id: "t1", content: "Survey vendors", status: "in_progress" }] };
      renderResearch();
      expect(screen.queryByText("Survey vendors")).not.toBeInTheDocument();

      await user.type(await screen.findByLabelText("Research query"), "vendors");
      await user.click(screen.getByRole("button", { name: "Start research agent" }));

      await waitFor(() => expect(screen.getAllByText("Survey vendors")).toHaveLength(2));
      expect(screen.getByRole("region", { name: "Research agent progress" })).toBeInTheDocument();
    });
  });

  describe("landing tab", () => {
    it("shows the landing empty state at /research", async () => {
      renderResearch();
      expect(await screen.findByText("Start researching")).toBeInTheDocument();
      expect(screen.getByLabelText("Research query")).toBeInTheDocument();
    });

    it("starts a research agent from the landing prompt and attaches its chat", async () => {
      const user = userEvent.setup();
      renderResearch();

      await user.type(await screen.findByLabelText("Research query"), "Solid-state battery timeline");
      await user.click(screen.getByRole("button", { name: "Start research agent" }));

      await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research" }));
      expect(sendInput).toHaveBeenCalledWith({
        agentId: "research-agent-1",
        input: { from: "Research app", message: "/deep research Solid-state battery timeline" },
      });
      await waitFor(() => expect(panelOpen("chat:research-agent-1")).toBe(true));
    });
  });

  describe("dossier tab", () => {
    const itemPath = "/research/solid-state-batteries/summary";

    it("opens a dossier in preview mode", async () => {
      renderResearch(itemPath);

      await waitFor(() => expect(getItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary" }));
      expect(await screen.findByText("Solid-state batteries are promising.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Preview/i })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByLabelText("Markdown editor")).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /summary/ })).toBeInTheDocument();
    });

    it("edits in the markdown editor, badges the tab and saves", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);

      expect(await screen.findByText("Solid-state batteries are promising.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Edit" }));
      const editor = await screen.findByLabelText("Markdown editor");
      await user.clear(editor);
      await user.type(editor, "# Updated summary");

      await waitFor(() => expect(hasUnsavedBadge()).toBe(true));

      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).not.toBeDisabled();
      await user.click(saveButton);

      await waitFor(() => expect(updateItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary", content: "# Updated summary" }));
      await waitFor(() => expect(hasUnsavedBadge()).toBe(false));
    });

    it("keeps what you type while a save is in flight", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);

      expect(await screen.findByText("Solid-state batteries are promising.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Edit" }));
      const editor = await screen.findByLabelText("Markdown editor");
      await user.clear(editor);
      await user.type(editor, "first");

      let finish = () => {};
      updateItem.mockImplementationOnce(
        args =>
          new Promise(resolve => {
            finish = () => resolve({ item: { ...args, size: args.content.length, updatedAt: "2026-07-02T00:00:00.000Z", sourceCount: 0, sources: [] } });
          }),
      );
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(updateItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary", content: "first" }));
      await user.type(editor, " and more");
      finish();

      await waitFor(() => expect((screen.getByLabelText("Markdown editor") as HTMLTextAreaElement).value).toBe("first and more"));
      expect(hasUnsavedBadge()).toBe(true);
    });

    it("keeps an unsaved draft when the app is closed and reopened", async () => {
      const user = userEvent.setup();
      const first = renderResearch(itemPath);
      await first.findByText("Solid-state batteries are promising.");
      await user.click(first.getByRole("button", { name: "Edit" }));
      const editor = await first.findByLabelText("Markdown editor");
      await user.clear(editor);
      await user.type(editor, "# Unsaved draft");
      first.unmount();

      const second = renderResearch(itemPath);
      await waitFor(() => expect(second.getByLabelText("Markdown editor")).toHaveValue("# Unsaved draft"));
    });

    it("saves with Ctrl+S while the tab is active", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Edit" }));
      const editor = await screen.findByLabelText("Markdown editor");
      await user.clear(editor);
      await user.type(editor, "shortcut save");
      await user.keyboard("{Control>}s{/Control}");

      await waitFor(() => expect(updateItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary", content: "shortcut save" }));
    });

    it("offers a retry when the dossier cannot be loaded", async () => {
      const user = userEvent.setup();
      getItemResult = null;
      renderResearch(itemPath);

      expect(await screen.findByText("Research item not found")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close panel" })).toBeInTheDocument();

      getItemResult = { ...summaryItem };
      await user.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Solid-state batteries are promising.")).toBeInTheDocument();
    });

    it("closes the tab from the not-found state", async () => {
      const user = userEvent.setup();
      getItemResult = null;
      renderResearch(itemPath);

      await user.click(await screen.findByRole("button", { name: "Close panel" }));
      await waitFor(() => expect(panelOpen(ITEM_KEY)).toBe(false));
    });

    it("saves a copy under a new name and the tab follows it", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Save As…" }));
      const dialog = screen.getByRole("dialog");
      const nameInput = within(dialog).getByPlaceholderText("summary");
      await user.clear(nameInput);
      await user.type(nameInput, "summary-v2");
      await user.click(within(dialog).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ topicName: "solid-state-batteries", name: "summary-v2" })));
      await waitFor(() => expect(pathname()).toBe("/research/solid-state-batteries/summary-v2"));
      expect(panelOpen(ITEM_KEY)).toBe(false);
      expect(panelOpen("research-item:solid-state-batteries/summary-v2")).toBe(true);
    });

    it("renames / moves the dossier; the tab, draft and URL follow it", async () => {
      const user = userEvent.setup();
      setItemDraft("solid-state-batteries/summary", "draft text");
      renderResearch(itemPath);

      await screen.findByLabelText("Markdown editor");
      await user.click(screen.getByRole("button", { name: "Rename or move item" }));
      const dialog = screen.getByRole("dialog");
      const topicInput = within(dialog).getByPlaceholderText("solid-state-batteries");
      await user.clear(topicInput);
      await user.type(topicInput, "local-ai-tools");
      const nameInput = within(dialog).getByPlaceholderText("summary");
      await user.clear(nameInput);
      await user.type(nameInput, "overview");
      await user.click(within(dialog).getByRole("button", { name: "Move" }));

      await waitFor(() =>
        expect(renameItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary", newTopicName: "local-ai-tools", newName: "overview" }),
      );
      await waitFor(() => expect(pathname()).toBe("/research/local-ai-tools/overview"));
      expect(panelOpen(ITEM_KEY)).toBe(false);
      expect(panelOpen("research-item:local-ai-tools/overview")).toBe(true);
      expect(getItemDraft("local-ai-tools/overview")).toBe("draft text");
      expect(getItemDraft("solid-state-batteries/summary")).toBeNull();
      expect(createItem).not.toHaveBeenCalled();
    });

    it("keeps everything in place when the move fails", async () => {
      const user = userEvent.setup();
      renameItem.mockImplementationOnce(async () => {
        throw new Error('Item "toc" already exists');
      });
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Rename or move item" }));
      const dialog = screen.getByRole("dialog");
      const nameInput = within(dialog).getByPlaceholderText("summary");
      await user.clear(nameInput);
      await user.type(nameInput, "toc");
      await user.click(within(dialog).getByRole("button", { name: "Move" }));

      await waitFor(() => expect(renameItem).toHaveBeenCalled());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(pathname()).toBe(itemPath);
    });

    it("exports the dossier on screen, unsaved edits included", async () => {
      const user = userEvent.setup();
      setItemDraft("solid-state-batteries/summary", "# Edited");
      renderResearch(itemPath);

      await screen.findByLabelText("Markdown editor");
      await user.click(screen.getByRole("button", { name: "Export item as Markdown" }));
      expect(downloadTextFile).toHaveBeenCalledWith("summary.md", "# Edited", "text/markdown");
    });

    it("keeps the tab open when the delete fails", async () => {
      const user = userEvent.setup();
      deleteItem.mockImplementationOnce(async () => ({ success: false }));
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Delete item" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteItem).toHaveBeenCalled());
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(panelOpen(ITEM_KEY)).toBe(true);
    });

    it("keeps the draft when saving a dossier deleted elsewhere conflicts", async () => {
      const user = userEvent.setup();
      updateItem.mockImplementationOnce(async () => {
        throw new Error('Item "summary" no longer exists in topic "solid-state-batteries"');
      });
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Edit" }));
      const editor = await screen.findByLabelText("Markdown editor");
      await user.type(editor, " more");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updateItem).toHaveBeenCalled());
      expect(getItemDraft("solid-state-batteries/summary")).toContain(" more");
      expect(hasUnsavedBadge()).toBe(true);
    });

    it("lists the item's sources separately, with safe external links", async () => {
      renderResearch(itemPath);

      const sources = await screen.findByRole("region", { name: "Sources" });
      expect(within(sources).getByText("Sources (2)")).toBeInTheDocument();
      const link = within(sources).getByRole("link", { name: /Annual report/ });
      expect(link).toHaveAttribute("href", "https://acme.example/report");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(within(sources).getByText("ACME Corp · accessed 2026-11-01")).toBeInTheDocument();
      // Without a title the host stands in.
      expect(within(sources).getByRole("link", { name: /news\.example/ })).toBeInTheDocument();
    });

    it("shows no sources section for an item without sources, and a warning for bad frontmatter", async () => {
      getItemResult = { ...summaryItem, sources: [], sourceCount: 0, warning: "Frontmatter could not be parsed; showing the raw text." };
      renderResearch(itemPath);

      expect(await screen.findByTestId("research-item-warning")).toHaveTextContent("showing the raw text");
      // An empty list still offers the editor's entry point.
      expect(within(screen.getByRole("region", { name: "Sources" })).getByText("No sources yet.")).toBeInTheDocument();
    });

    it("keeps sources when saving: saving in the editor does not send them (the server keeps them)", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);
      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Edit" }));
      await user.type(await screen.findByLabelText("Markdown editor"), " more");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updateItem).toHaveBeenCalled());
      expect(updateItem.mock.calls[0]?.[0]).not.toHaveProperty("sources");
    });

    describe("source editor", () => {
      const TODAY = new Date().toISOString().slice(0, 10);
      // A region while previewing, a collapsible <details> under the editor.
      const sourcesRegion = () => (document.querySelector('[aria-label="Sources"]') ?? screen.getByRole("region", { name: "Sources" })) as HTMLElement;
      const openItem = async () => {
        const user = userEvent.setup();
        renderResearch(itemPath);
        await screen.findByText("Solid-state batteries are promising.");
        return user;
      };
      const lastUpdate = () => updateItem.mock.calls.at(-1)?.[0];

      it("adds a source with today's date, saving the full list and the saved body byte for byte", async () => {
        const rawBody = "# Summary\n\n  Odd   spacing  \n\n\n";
        getItemResult = { ...summaryItem, content: rawBody };
        const user = userEvent.setup();
        renderResearch(itemPath);
        await screen.findByText("Summary");

        await user.click(within(sourcesRegion()).getByRole("button", { name: "Add source" }));
        expect(screen.getByLabelText("Accessed")).toHaveValue(TODAY);
        await user.type(screen.getByLabelText(/URL/), "https://new.example/page");
        await user.type(screen.getByLabelText("Title"), "New page");
        await user.type(screen.getByLabelText("Publisher"), "New Co");
        await user.click(screen.getByRole("button", { name: "Add source" }));

        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
        expect(lastUpdate()).toEqual({
          topicName: "solid-state-batteries",
          name: "summary",
          content: rawBody,
          sources: [...summaryItem.sources, { url: "https://new.example/page", title: "New page", publisher: "New Co", accessed: TODAY }],
          baseSources: summaryItem.sources, // what the editor started from, so a concurrent change is refused
        });
        expect(await within(sourcesRegion()).findByText("Sources (3)")).toBeInTheDocument();
      });

      it("rejects an empty, non-http or duplicate URL inline without calling the server", async () => {
        const user = await openItem();
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Add source" }));
        const submit = () => user.click(screen.getByRole("button", { name: "Add source" }));

        await submit();
        expect(await screen.findByText("Enter the URL of the source.")).toBeInTheDocument();

        await user.type(screen.getByLabelText(/URL/), "ftp://files.example/x");
        await submit();
        expect(await screen.findByText("Use a full http:// or https:// URL.")).toBeInTheDocument();

        await user.clear(screen.getByLabelText(/URL/));
        await user.type(screen.getByLabelText(/URL/), "https://acme.example/report");
        await submit();
        expect(await screen.findByText("This URL is already listed.")).toBeInTheDocument();
        expect(updateItem).not.toHaveBeenCalled();
      });

      it("edits one source and leaves the others as they were", async () => {
        const user = await openItem();
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Edit source 1" }));
        const title = screen.getByLabelText("Title");
        expect(title).toHaveValue("Annual report");
        await user.clear(title);
        await user.type(title, "Annual report 2026");
        await user.click(screen.getByRole("button", { name: "Save source" }));

        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
        expect(lastUpdate()?.sources).toEqual([{ ...summaryItem.sources[0]!, title: "Annual report 2026" }, ...summaryItem.sources.slice(1)]);
        expect(lastUpdate()?.content).toBe(summaryItem.content);
        expect(await within(sourcesRegion()).findByRole("link", { name: /Annual report 2026/ })).toBeInTheDocument();
      });

      it("removes a source and offers Undo, which writes the previous list back", async () => {
        const user = await openItem();
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Remove source 2" }));

        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
        expect(lastUpdate()?.sources).toEqual(summaryItem.sources.slice(0, 1));
        expect(await within(sourcesRegion()).findByText("Sources (1)")).toBeInTheDocument();

        await user.click(within(sourcesRegion()).getByRole("button", { name: "Undo" }));
        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(2));
        expect(lastUpdate()?.sources).toEqual(summaryItem.sources);
        expect(await within(sourcesRegion()).findByText("Sources (2)")).toBeInTheDocument();
      });

      it("writes an empty list when the last source is removed", async () => {
        getItemResult = { ...summaryItem, sources: [summaryItem.sources[0]!], sourceCount: 1 };
        const user = await openItem();
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Remove source 1" }));

        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
        expect(lastUpdate()).toMatchObject({ content: summaryItem.content, sources: [] });
        expect(await within(sourcesRegion()).findByText("No sources yet.")).toBeInTheDocument();
      });

      it("keeps unsaved text edits as a draft and says so when sources are saved", async () => {
        const user = await openItem();
        await user.click(screen.getByRole("button", { name: "Edit" }));
        await user.type(await screen.findByLabelText("Markdown editor"), " DRAFT");

        await user.click(within(sourcesRegion()).getByText(/^Sources \(2\)/));
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Remove source 1" }));

        await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1));
        // The draft never reaches disk: the body sent is the saved text.
        expect(lastUpdate()?.content).toBe(summaryItem.content);
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Sources saved. Your unsaved text edits were kept as a draft.", { duration: 4000 }));
        expect(screen.getByLabelText("Markdown editor")).toHaveValue(`${summaryItem.content} DRAFT`);
        expect(getItemDraft("solid-state-batteries/summary")).toBe(`${summaryItem.content} DRAFT`);
      });

      it("shows a failed save inside the editor and keeps the form open", async () => {
        updateItem.mockImplementationOnce(async () => {
          throw new Error("disk full");
        });
        const user = await openItem();
        await user.click(within(sourcesRegion()).getByRole("button", { name: "Add source" }));
        await user.type(screen.getByLabelText(/URL/), "https://new.example/page");
        await user.click(screen.getByRole("button", { name: "Add source" }));

        expect(await screen.findByText(/disk full/)).toBeInTheDocument();
        expect(screen.getByLabelText(/URL/)).toHaveValue("https://new.example/page");
      });
    });

    it("deletes the dossier after confirmation and closes the tab", async () => {
      const user = userEvent.setup();
      renderResearch(itemPath);

      await screen.findByText("Solid-state batteries are promising.");
      await user.click(screen.getByRole("button", { name: "Delete item" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary" }));
      await waitFor(() => expect(panelOpen(ITEM_KEY)).toBe(false));
      await waitFor(() => expect(pathname()).toBe("/research"));
    });
  });
});
