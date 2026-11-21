/**
 * Generic parsing of Common Paper standard-terms markdown (templates/*.md) into
 * renderable clauses. Document-agnostic: shared by every document type.
 */

/** A run of clause text: plain, bold, or a reference to a Cover Page term. */
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "term"; term: string };

export interface Clause {
  number: string;
  title: string;
  segments: Segment[];
}

export interface StandardTerms {
  clauses: Clause[];
  attribution: string;
}

const TOKEN = /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>/g;
const CLAUSE = /^(\d+)\.\s+\*\*(.+?)\*\*\.\s*(.*)$/;

/** Strip markdown links "[text](url)" down to their text. */
const stripLinks = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) segments.push({ kind: "text", text: text.slice(last, match.index) });
    segments.push(
      match[1] !== undefined ? { kind: "bold", text: match[1] } : { kind: "term", term: match[2] },
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

/** Parse top-level numbered clauses plus the trailing license/attribution line. */
export function parseStandardTerms(markdown: string): StandardTerms {
  const clauses: Clause[] = [];
  let attribution = "";
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = CLAUSE.exec(line);
    if (match) {
      clauses.push({ number: match[1], title: match[2], segments: parseSegments(stripLinks(match[3])) });
    } else {
      attribution = stripLinks(line);
    }
  }
  return { clauses, attribution };
}
