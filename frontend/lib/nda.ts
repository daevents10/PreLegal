/**
 * Mutual NDA domain model: form data, defaults, validation, and how Cover Page
 * values fill the Standard Terms. Shared by the HTML preview and the PDF so both stay in sync.
 */

export const MNDA_TEMPLATE_FILE = "mutual-nda.md";

export interface Party {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
}

export const PARTY_KEYS = ["party1", "party2"] as const;
export type PartyKey = (typeof PARTY_KEYS)[number];

export type MndaTermType = "expires" | "continues";
export type ConfidentialityType = "years" | "perpetual";

export interface NdaData {
  purpose: string;
  effectiveDate: string; // ISO yyyy-mm-dd
  mndaTermType: MndaTermType;
  mndaTermYears: number;
  confidentialityType: ConfidentialityType;
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
}

const emptyParty = (): Party => ({ name: "", title: "", company: "", noticeAddress: "" });

/** Local-time yyyy-mm-dd (avoids the UTC shift of toISOString). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function defaultNdaData(today: Date = new Date()): NdaData {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: toIsoDate(today),
    mndaTermType: "expires",
    mndaTermYears: 1,
    confidentialityType: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: emptyParty(),
    party2: emptyParty(),
  };
}

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

/** "November 21, 2026" for a real yyyy-mm-dd calendar date; empty string otherwise. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(2000, m - 1, d);
  date.setFullYear(y); // avoid the 0-99 => 1900s mapping of the Date constructor
  // Reject rollovers such as 2026-02-31 => March 3.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function describeMndaTerm(data: NdaData): string {
  return data.mndaTermType === "expires"
    ? `Expires ${years(data.mndaTermYears)} from Effective Date.`
    : "Continues until terminated in accordance with the terms of the MNDA.";
}

export function describeConfidentiality(data: NdaData): string {
  return data.confidentialityType === "years"
    ? `${years(data.confidentialityYears)} from Effective Date, but in the case of trade secrets until ` +
        "Confidential Information is no longer considered a trade secret under applicable laws."
    : "In perpetuity.";
}

/** The trimmed value, or "[placeholder]" while it is still empty. */
export function valueOrPlaceholder(value: string, placeholder: string): string {
  return value.trim() || `[${placeholder}]`;
}

/** Labels of required fields that are still empty or invalid. */
export function missingFields(data: NdaData): string[] {
  const missing: string[] = [];
  const blank = (s: string) => s.trim() === "";
  const validYears = (n: number) => Number.isInteger(n) && n >= 1;

  if (blank(data.purpose)) missing.push("Purpose");
  if (!formatDate(data.effectiveDate)) missing.push("Effective Date");
  if (data.mndaTermType === "expires" && !validYears(data.mndaTermYears)) missing.push("MNDA Term");
  if (data.confidentialityType === "years" && !validYears(data.confidentialityYears)) {
    missing.push("Term of Confidentiality");
  }
  if (blank(data.governingLaw)) missing.push("Governing Law");
  if (blank(data.jurisdiction)) missing.push("Jurisdiction");
  PARTY_KEYS.forEach((key, i) => {
    if (blank(data[key].company)) missing.push(`Party ${i + 1} Company`);
    if (blank(data[key].name)) missing.push(`Party ${i + 1} Print Name`);
  });
  return missing;
}

/** Rows of the Cover Page signature table; Signature and Date are left blank for signing. */
export const SIGNATURE_ROWS: { label: string; value: (party: Party) => string }[] = [
  { label: "Signature", value: () => "" },
  { label: "Print Name", value: (p) => p.name },
  { label: "Title", value: (p) => p.title },
  { label: "Company", value: (p) => p.company },
  { label: "Notice Address", value: (p) => p.noticeAddress },
  { label: "Date", value: () => "" },
];

/** Download filename such as "Mutual-NDA-Acme-Inc-Globex.pdf". */
export function pdfFileName(data: NdaData): string {
  const slug = (s: string) =>
    s.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const parts = PARTY_KEYS.map((key) => slug(data[key].company)).filter(Boolean);
  return ["Mutual-NDA", ...parts].join("-") + ".pdf";
}

/** Cover Page terms whose values are written inline into the Standard Terms. */
const INLINED_TERMS: Record<string, (data: NdaData) => string> = {
  "Governing Law": (data) => data.governingLaw,
  Jurisdiction: (data) => data.jurisdiction,
};

/**
 * Value to inline for a Standard Terms reference to a Cover Page term:
 * undefined if the term is shown as a reference (e.g. "Purpose"), otherwise the
 * trimmed value (empty string while the user has not filled it in yet).
 */
export function resolveTerm(term: string, data: NdaData): string | undefined {
  return INLINED_TERMS[term]?.(data).trim();
}
