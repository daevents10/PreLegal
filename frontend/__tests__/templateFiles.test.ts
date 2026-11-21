// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MNDA_TEMPLATE_FILE } from "@/lib/nda";
import { loadStandardTerms } from "@/lib/templateFiles";
import { TERMS } from "./fixtures";

describe("loadStandardTerms", () => {
  it("loads and parses a template from the repo templates/ directory", async () => {
    expect(await loadStandardTerms(MNDA_TEMPLATE_FILE)).toEqual(TERMS);
  });

  it("rejects for a missing template", async () => {
    await expect(loadStandardTerms("does-not-exist.md")).rejects.toThrow(/ENOENT/);
  });
});
