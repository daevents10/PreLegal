import { readFileSync } from "node:fs";
import path from "node:path";
import { defaultNdaData, MNDA_TEMPLATE_FILE, type NdaData } from "@/lib/nda";
import { parseStandardTerms } from "@/lib/templates";

/** The real Standard Terms from the templates dataset. */
export const TEMPLATE_MARKDOWN = readFileSync(
  path.join(__dirname, "..", "..", "templates", MNDA_TEMPLATE_FILE),
  "utf-8",
);
export const TERMS = parseStandardTerms(TEMPLATE_MARKDOWN);

/** A fully completed NDA. */
export function completeNda(): NdaData {
  return {
    ...defaultNdaData(new Date(2026, 10, 21)),
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    party1: { name: "Ada Lovelace", title: "CEO", company: "Acme, Inc.", noticeAddress: "ada@acme.test" },
    party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.test" },
  };
}
