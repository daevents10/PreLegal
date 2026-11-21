import { describe, expect, it } from "vitest";
import {
  defaultNdaData,
  describeConfidentiality,
  describeMndaTerm,
  formatDate,
  missingFields,
  pdfFileName,
  resolveTerm,
  toIsoDate,
  valueOrPlaceholder,
} from "@/lib/nda";
import { parseSegments, parseStandardTerms } from "@/lib/templates";
import { completeNda, TERMS } from "./fixtures";

describe("defaults and dates", () => {
  it("defaults effective date to today and 1-year terms", () => {
    const data = defaultNdaData(new Date(2026, 0, 5));
    expect(data.effectiveDate).toBe("2026-01-05");
    expect(data.mndaTermType).toBe("expires");
    expect(data.mndaTermYears).toBe(1);
    expect(data.confidentialityYears).toBe(1);
    expect(data.purpose).toMatch(/business relationship/);
  });

  it("formats ISO dates in local time", () => {
    expect(toIsoDate(new Date(2026, 10, 21))).toBe("2026-11-21");
    expect(formatDate("2026-11-21")).toBe("November 21, 2026");
    expect(formatDate("")).toBe("");
    expect(formatDate("not-a-date")).toBe("");
  });

  it("rejects impossible calendar dates instead of rolling over", () => {
    expect(formatDate("2026-02-31")).toBe("");
    expect(formatDate("2026-13-01")).toBe("");
    expect(formatDate("2028-02-29")).toBe("February 29, 2028");
    expect(formatDate("0005-01-01")).toMatch(/\b5$/);
    expect(missingFields({ ...completeNda(), effectiveDate: "2026-02-31" })).toEqual(["Effective Date"]);
  });

  it("shows a placeholder for blank values", () => {
    expect(valueOrPlaceholder("  Delaware ", "Governing Law")).toBe("Delaware");
    expect(valueOrPlaceholder("  ", "Governing Law")).toBe("[Governing Law]");
  });
});

describe("term descriptions", () => {
  it("describes MNDA term with pluralisation", () => {
    const data = completeNda();
    expect(describeMndaTerm(data)).toBe("Expires 1 year from Effective Date.");
    expect(describeMndaTerm({ ...data, mndaTermYears: 3 })).toBe("Expires 3 years from Effective Date.");
    expect(describeMndaTerm({ ...data, mndaTermType: "continues" })).toMatch(/until terminated/);
  });

  it("describes confidentiality term", () => {
    const data = completeNda();
    expect(describeConfidentiality({ ...data, confidentialityYears: 2 })).toMatch(/^2 years from Effective Date.*trade secret/);
    expect(describeConfidentiality({ ...data, confidentialityType: "perpetual" })).toBe("In perpetuity.");
  });
});

describe("missingFields", () => {
  it("is empty for a complete NDA", () => {
    expect(missingFields(completeNda())).toEqual([]);
  });

  it("lists all required fields on the default form", () => {
    expect(missingFields(defaultNdaData())).toEqual([
      "Governing Law",
      "Jurisdiction",
      "Party 1 Company",
      "Party 1 Print Name",
      "Party 2 Company",
      "Party 2 Print Name",
    ]);
  });

  it("treats whitespace as blank and validates year counts only when used", () => {
    const data = { ...completeNda(), purpose: "   ", mndaTermYears: 0, confidentialityYears: 0, effectiveDate: "" };
    expect(missingFields(data)).toEqual(["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality"]);
    expect(
      missingFields({ ...data, purpose: "x", effectiveDate: "2026-01-01", mndaTermType: "continues", confidentialityType: "perpetual" }),
    ).toEqual([]);
  });
});

describe("pdfFileName", () => {
  it("slugs company names", () => {
    expect(pdfFileName(completeNda())).toBe("Mutual-NDA-Acme-Inc-Globex.pdf");
    expect(pdfFileName(defaultNdaData())).toBe("Mutual-NDA.pdf");
  });
});

describe("Standard Terms parsing", () => {
  it("parses all 11 clauses of the real template plus attribution", () => {
    expect(TERMS.clauses.map((c) => c.number)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
    expect(TERMS.clauses[0].title).toBe("Introduction");
    expect(TERMS.clauses[8].title).toBe("Governing Law and Jurisdiction");
    expect(TERMS.attribution).toMatch(/^Common Paper Mutual Non-Disclosure Agreement Version 1\.0 free to use under CC BY 4\.0\.$/);
  });

  it("leaves no raw markdown or HTML in clause text", () => {
    for (const clause of TERMS.clauses) {
      for (const segment of clause.segments) {
        const text = segment.kind === "term" ? segment.term : segment.text;
        expect(text).not.toMatch(/<span|\*\*|\]\(/);
      }
    }
  });

  it("splits bold text and cover page term references", () => {
    expect(parseSegments('use for the <span class="coverpage_link">Purpose</span> (“**MNDA**”).')).toEqual([
      { kind: "text", text: "use for the " },
      { kind: "term", term: "Purpose" },
      { kind: "text", text: " (“" },
      { kind: "bold", text: "MNDA" },
      { kind: "text", text: "”)." },
    ]);
  });

  it("ignores headings and blank lines, handles CRLF", () => {
    const parsed = parseStandardTerms("# Standard Terms\r\n\r\n1. **One**. First.\r\n\r\nFooter [link](http://x)\r\n");
    expect(parsed.clauses).toEqual([{ number: "1", title: "One", segments: [{ kind: "text", text: "First." }] }]);
    expect(parsed.attribution).toBe("Footer link");
  });
});

describe("resolveTerm", () => {
  it("inlines governing law and jurisdiction only", () => {
    const data = completeNda();
    expect(resolveTerm("Governing Law", data)).toBe("Delaware");
    expect(resolveTerm("Jurisdiction", data)).toBe("New Castle, DE");
    expect(resolveTerm("Purpose", data)).toBeUndefined();
    expect(resolveTerm("Effective Date", data)).toBeUndefined();
    // Inlined term not yet filled in: empty string (rendered as a placeholder), not undefined.
    expect(resolveTerm("Governing Law", { ...data, governingLaw: " " })).toBe("");
  });
});
