import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseStandardTerms, type StandardTerms } from "@/lib/templates";

/**
 * Directory holding the templates dataset. Defaults to the repo's templates/ next to
 * frontend/; override with TEMPLATES_DIR (e.g. in a Docker build stage).
 */
export const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? path.join(process.cwd(), "..", "templates");

/** Read and parse a template's standard terms at build time. */
export async function loadStandardTerms(filename: string): Promise<StandardTerms> {
  return parseStandardTerms(await readFile(path.join(TEMPLATES_DIR, filename), "utf-8"));
}
