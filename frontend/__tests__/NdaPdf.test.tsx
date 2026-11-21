// @vitest-environment node
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { NdaDocument } from "@/components/NdaPdf";
import { completeNda, TERMS } from "./fixtures";

describe("NdaDocument PDF", () => {
  it("renders a valid multi-page PDF for a completed NDA", async () => {
    const buffer = await renderToBuffer(<NdaDocument data={completeNda()} terms={TERMS} />);
    const raw = buffer.toString("latin1");
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(raw).toMatch(/\/Title\b/);
    expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
