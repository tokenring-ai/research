import { describe, expect, it } from "bun:test";
import path from "node:path";

/**
 * The web app imports the RPC schema, so everything it imports must bundle for the browser. A server-only import
 * (Bun's YAML, node:fs) in that chain breaks the whole app at startup, and no unit test of the module itself notices.
 */
describe("research RPC schema", () => {
  it("bundles for the browser", async () => {
    const result = await Bun.build({ entrypoints: [path.join(import.meta.dir, "..", "rpc", "schema.ts")], target: "browser", throw: false });
    expect(result.logs.map(log => log.message)).toEqual([]);
    expect(result.success).toBe(true);
  }, 30000);

  it("does not pull the DOCX / PDF export libraries into the browser bundle", async () => {
    const result = await Bun.build({ entrypoints: [path.join(import.meta.dir, "..", "rpc", "schema.ts")], target: "browser", throw: false });
    const code = (await Promise.all(result.outputs.map(output => output.text()))).join("\n");
    for (const marker of ["PDFDocument", "ExternalHyperlink", "Packer", "StandardFonts", "marked"]) expect(code).not.toContain(marker);
  }, 30000);
});
