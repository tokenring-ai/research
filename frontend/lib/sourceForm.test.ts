import { describe, expect, it } from "bun:test";
import { toFormValues, validateSourceForm } from "./sourceForm.ts";

const base = { url: "https://a.example/x", title: "", publisher: "", accessed: "2026-11-16" };

describe("validateSourceForm", () => {
  it("defaults the accessed date to the supplied day", () => {
    expect(toFormValues(null, "2026-11-16")).toEqual({ url: "", title: "", publisher: "", accessed: "2026-11-16" });
    expect(toFormValues({ url: "https://a.example", title: "T", accessed: "2026-01-01" }, "2026-11-16")).toEqual({
      url: "https://a.example",
      title: "T",
      publisher: "",
      accessed: "2026-01-01",
    });
  });

  it("trims fields and leaves empty optional ones out", () => {
    expect(validateSourceForm({ ...base, url: "  https://a.example/x  ", title: " T " }, []).source).toEqual({
      url: "https://a.example/x",
      title: "T",
      accessed: "2026-11-16",
    });
  });

  it("requires an http(s) URL", () => {
    expect(validateSourceForm({ ...base, url: "" }, []).errors.url).toBe("Enter the URL of the source.");
    expect(validateSourceForm({ ...base, url: "example.com" }, []).errors.url).toBe("Use a full http:// or https:// URL.");
    expect(validateSourceForm({ ...base, url: "javascript:alert(1)" }, []).errors.url).toBe("Use a full http:// or https:// URL.");
    expect(validateSourceForm({ ...base, url: "http://example.com" }, []).errors.url).toBeUndefined();
  });

  it("rejects a URL another source already uses", () => {
    expect(validateSourceForm(base, [{ url: "https://a.example/x" }]).errors.url).toBe("This URL is already listed.");
  });

  it("rejects dates that are not real", () => {
    expect(validateSourceForm({ ...base, accessed: "2026-13-40" }, []).errors.accessed).toBe("Use a valid date (YYYY-MM-DD).");
    expect(validateSourceForm({ ...base, accessed: "11/16/2026" }, []).errors.accessed).toBe("Use a valid date (YYYY-MM-DD).");
    expect(validateSourceForm({ ...base, accessed: "2026-02-30" }, []).errors.accessed).toBe("Use a valid date (YYYY-MM-DD).");
  });
});
