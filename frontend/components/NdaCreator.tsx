"use client";

import { useState } from "react";
import NdaChat from "@/components/NdaChat";
import NdaPreview from "@/components/NdaPreview";
import { defaultNdaData, missingFields, pdfFileName, type NdaData } from "@/lib/nda";
import type { StandardTerms } from "@/lib/templates";

/** Trigger a browser download. The link is attached and the URL revoked later so Firefox/Safari don't cancel it. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function NdaCreator({ terms }: { terms: StandardTerms }) {
  const [data, setData] = useState<NdaData>(() => defaultNdaData());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = missingFields(data);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand: the PDF renderer is large and browser-only.
      const { renderNdaPdf } = await import("@/components/NdaPdf");
      saveBlob(await renderNdaPdf(data, terms), pdfFileName(data));
    } catch (err) {
      console.error(err);
      setError("Sorry, the PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="details-heading" className="space-y-4">
        <h2 id="details-heading" className="text-lg font-semibold text-navy">
          Chat with the assistant
        </h2>
        <NdaChat data={data} onChange={setData} />
      </section>

      <section aria-labelledby="preview-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="preview-heading" className="text-lg font-semibold text-navy">
            Preview
          </h2>
          <button
            type="button"
            onClick={handleDownload}
            disabled={missing.length > 0 || downloading}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
        </div>
        {missing.length > 0 && (
          <p role="status" className="rounded-md border border-accent bg-accent/10 px-3 py-2 text-sm text-navy">
            Still needed to download: {missing.join(", ")}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <NdaPreview data={data} terms={terms} />
        </div>
      </section>
    </div>
  );
}
