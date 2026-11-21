import NdaCreator from "@/components/NdaCreator";
import { MNDA_TEMPLATE_FILE } from "@/lib/nda";
import { loadStandardTerms } from "@/lib/templateFiles";

export default async function Home() {
  // Read at build time (static export): the templates/ dataset is the single source of the Standard Terms.
  const terms = await loadStandardTerms(MNDA_TEMPLATE_FILE);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold text-navy">
          Prelegal <span className="text-accent">·</span> Mutual NDA Creator
        </h1>
        <p className="text-sm text-muted">
          Chat with the AI assistant to fill in the key terms, review the agreement, and download a ready-to-sign PDF.
        </p>
      </header>
      <NdaCreator terms={terms} />
    </main>
  );
}
