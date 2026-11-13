import { beforeEach, describe, expect, it, mock } from "bun:test";
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
  { name: "solid-state-batteries", itemCount: 2, updatedAt: "2026-07-01T12:00:00.000Z" },
  { name: "local-ai-tools", itemCount: 0, updatedAt: "2026-07-01T11:00:00.000Z" },
];

const batteryItems = [
  { topicName: "solid-state-batteries", name: "summary", size: 420, updatedAt: "2026-07-01T12:00:00.000Z" },
  { topicName: "solid-state-batteries", name: "toc", size: 180, updatedAt: "2026-07-01T12:01:00.000Z" },
];

const summaryItem = {
  topicName: "solid-state-batteries",
  name: "summary",
  content: "# Summary\n\nSolid-state batteries are promising.",
  size: 420,
  updatedAt: "2026-07-01T12:00:00.000Z",
};

let topicsState = [...topics];
let itemsByTopic: Record<string, typeof batteryItems> = {};
let getItemResult: typeof summaryItem | null = summaryItem;
let configurationState: { agentTypes: string[]; searchProviderAvailable: boolean } = { agentTypes: ["research"], searchProviderAvailable: true };

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({ id: "research-agent-1", displayName: "Researcher", description: "" }));
const sendInput = mock(async () => ({ status: "success" as const, requestId: "req-1" }));
const deleteAgent = mock(async () => ({ status: "success" as const }));
const createTopic = mock(async (_args: { name: string }) => ({ topic: { name: _args.name, itemCount: 0, updatedAt: "2026-07-02T00:00:00.000Z" } }));
const deleteTopic = mock(async (_args: { name: string }) => ({ success: true }));
const createItem = mock(async (args: { topicName: string; name: string; content: string }) => ({
  item: { topicName: args.topicName, name: args.name, content: args.content, size: args.content.length, updatedAt: "2026-07-02T00:00:00.000Z" },
}));
const updateItem = mock(async (args: { topicName: string; name: string; content: string }) => ({
  item: { topicName: args.topicName, name: args.name, content: args.content, size: args.content.length, updatedAt: "2026-07-02T00:00:00.000Z" },
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
  },
}));

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
      downloadTextFile,
    ]) {
      fn.mockClear();
    }
    topicsState = [...topics];
    itemsByTopic = { "solid-state-batteries": [...batteryItems], "local-ai-tools": [] };
    getItemResult = { ...summaryItem };
    configurationState = { agentTypes: ["research"], searchProviderAvailable: true };
    todosState = undefined;
  });

  describe("layout", () => {
    it("keeps the old dashboard's identity and can host agent chats", () => {
      const app = layout.apps[0]!;
      expect(app).toMatchObject({ id: "research", path: "/research", label: "Research", group: "Build", shortLabel: "RE", defaultPinned: true });
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

      await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false }));
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
      await user.click(screen.getByRole("button", { name: /Edit/i }));
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

    it("keeps an unsaved draft when the app is closed and reopened", async () => {
      const user = userEvent.setup();
      const first = renderResearch(itemPath);
      await first.findByText("Solid-state batteries are promising.");
      await user.click(first.getByRole("button", { name: /Edit/i }));
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
      await user.click(screen.getByRole("button", { name: /Edit/i }));
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
      await user.click(screen.getByRole("button", { name: /Edit/i }));
      const editor = await screen.findByLabelText("Markdown editor");
      await user.type(editor, " more");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updateItem).toHaveBeenCalled());
      expect(getItemDraft("solid-state-batteries/summary")).toContain(" more");
      expect(hasUnsavedBadge()).toBe(true);
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
