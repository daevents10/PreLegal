import type { ReactNode } from "react";
import {
  describeConfidentiality,
  describeMndaTerm,
  formatDate,
  resolveTerm,
  SIGNATURE_ROWS,
  valueOrPlaceholder,
  type NdaData,
} from "@/lib/nda";
import type { Segment, StandardTerms } from "@/lib/templates";

interface Props {
  data: NdaData;
  terms: StandardTerms;
}

/** A filled-in value, or a highlighted placeholder when still empty. */
function Fill({ value, placeholder }: { value: string; placeholder: string }) {
  return value.trim() ? (
    <span className="font-medium text-navy">{value}</span>
  ) : (
    <span className="rounded bg-accent/20 px-1 text-muted">{valueOrPlaceholder(value, placeholder)}</span>
  );
}

function renderSegment(segment: Segment, data: NdaData, key: number): ReactNode {
  switch (segment.kind) {
    case "text":
      return segment.text;
    case "bold":
      return <strong key={key}>{segment.text}</strong>;
    case "term": {
      const value = resolveTerm(segment.term, data);
      return value === undefined ? (
        <span key={key} className="underline decoration-primary decoration-2 underline-offset-2">
          {segment.term}
        </span>
      ) : (
        <Fill key={key} value={value} placeholder={segment.term} />
      );
    }
  }
}

function CoverSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">{title}</h3>
      <div className="text-sm text-gray-800">{children}</div>
    </section>
  );
}

export default function NdaPreview({ data, terms }: Props) {
  return (
    <article aria-label="Mutual NDA preview" className="space-y-6 font-serif">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-navy">Mutual Non-Disclosure Agreement</h1>
        <p className="text-xs text-muted">Cover Page</p>
      </header>

      <p className="text-sm text-gray-800">
        This Mutual Non-Disclosure Agreement (the &ldquo;MNDA&rdquo;) consists of: (1) this Cover Page
        (&ldquo;<strong>Cover Page</strong>&rdquo;) and (2) the Common Paper Mutual NDA Standard Terms
        Version 1.0 (&ldquo;<strong>Standard Terms</strong>&rdquo;). Any modifications of the Standard
        Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.
      </p>

      <CoverSection title="Purpose">
        <Fill value={data.purpose} placeholder="Purpose" />
      </CoverSection>
      <CoverSection title="Effective Date">
        <Fill value={formatDate(data.effectiveDate)} placeholder="Effective Date" />
      </CoverSection>
      <CoverSection title="MNDA Term">{describeMndaTerm(data)}</CoverSection>
      <CoverSection title="Term of Confidentiality">{describeConfidentiality(data)}</CoverSection>
      <CoverSection title="Governing Law & Jurisdiction">
        <p>
          Governing Law: <Fill value={data.governingLaw} placeholder="Governing Law" />
        </p>
        <p>
          Jurisdiction: courts located in <Fill value={data.jurisdiction} placeholder="Jurisdiction" />
        </p>
      </CoverSection>
      <CoverSection title="MNDA Modifications">
        {data.modifications.trim() ? <p className="whitespace-pre-line">{data.modifications}</p> : "None."}
      </CoverSection>

      <p className="text-sm text-gray-800">
        By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-navy text-left text-navy">
            <th className="w-1/4 py-2" />
            <th className="py-2">PARTY 1</th>
            <th className="py-2">PARTY 2</th>
          </tr>
        </thead>
        <tbody>
          {SIGNATURE_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-gray-200">
              <th scope="row" className="py-3 pr-2 text-left font-medium text-muted">
                {row.label}
              </th>
              <td className="py-3 pr-2">{row.value(data.party1)}</td>
              <td className="py-3">{row.value(data.party2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="space-y-3 border-t border-gray-200 pt-6">
        <h2 className="text-center text-xl font-bold text-navy">Standard Terms</h2>
        <ol className="space-y-3 text-sm leading-relaxed text-gray-800">
          {terms.clauses.map((clause) => (
            <li key={clause.number}>
              {clause.number}. <strong>{clause.title}</strong>.{" "}
              {clause.segments.map((segment, i) => renderSegment(segment, data, i))}
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">{terms.attribution}</p>
      </section>
    </article>
  );
}
