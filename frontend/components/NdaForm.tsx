"use client";

import type { ReactNode } from "react";
import { PARTY_KEYS, type NdaData, type Party, type PartyKey } from "@/lib/nda";

interface Props {
  data: NdaData;
  onChange: (data: NdaData) => void;
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

const PARTY_FIELDS: { field: keyof Party; label: string }[] = [
  { field: "company", label: "Company" },
  { field: "name", label: "Print Name" },
  { field: "title", label: "Title" },
  { field: "noticeAddress", label: "Notice Address (email or postal)" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-secondary">{title}</legend>
      {children}
    </fieldset>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  rows?: number; // renders a textarea when set
}

function TextField({ id, label, value, onChange, type = "text", placeholder, rows }: TextFieldProps) {
  const common = { id, className: inputClass, value, placeholder };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-navy">
        {label}
      </label>
      {rows ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Parses a years input; blank/invalid becomes 0 so validation flags it. */
const toYears = (value: string) => {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
};

interface TermChoiceProps<T extends string> {
  label: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  years: number;
  onYearsChange: (years: number) => void;
  /** Option that uses the years input, with text shown before/after the input. */
  yearsOption: { value: T; before?: string; after: string; inputLabel: string };
  /** Open-ended alternative option. */
  otherOption: { value: T; label: string };
}

/** Radio pair: "N year(s)" with a number input, or an open-ended alternative. */
function TermChoice<T extends string>(props: TermChoiceProps<T>) {
  const { label, name, value, onChange, years, onYearsChange, yearsOption, otherOption } = props;
  const usesYears = value === yearsOption.value;
  return (
    <div className="space-y-2" role="radiogroup" aria-label={label}>
      <span className="block text-sm font-medium text-navy">{label}</span>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="radio" name={name} checked={usesYears} onChange={() => onChange(yearsOption.value)} />
        {yearsOption.before}
        <input
          type="number"
          min={1}
          aria-label={yearsOption.inputLabel}
          className={`${inputClass} w-20`}
          value={years || ""}
          disabled={!usesYears}
          onChange={(e) => onYearsChange(toYears(e.target.value))}
        />
        {yearsOption.after}
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name={name}
          checked={value === otherOption.value}
          onChange={() => onChange(otherOption.value)}
        />
        {otherOption.label}
      </label>
    </div>
  );
}

export default function NdaForm({ data, onChange }: Props) {
  const set = <K extends keyof NdaData>(key: K, value: NdaData[K]) => onChange({ ...data, [key]: value });
  const setParty = (key: PartyKey, field: keyof Party, value: string) =>
    onChange({ ...data, [key]: { ...data[key], [field]: value } });

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()} aria-label="Mutual NDA details">
      <Section title="Agreement">
        <TextField id="purpose" label="Purpose" rows={3} value={data.purpose} onChange={(v) => set("purpose", v)} />
        <TextField
          id="effectiveDate"
          label="Effective Date"
          type="date"
          value={data.effectiveDate}
          onChange={(v) => set("effectiveDate", v)}
        />
      </Section>

      <Section title="Terms">
        <TermChoice
          label="MNDA Term"
          name="mndaTermType"
          value={data.mndaTermType}
          onChange={(v) => set("mndaTermType", v)}
          years={data.mndaTermYears}
          onYearsChange={(n) => set("mndaTermYears", n)}
          yearsOption={{ value: "expires", before: "Expires after", after: "year(s)", inputLabel: "MNDA term in years" }}
          otherOption={{ value: "continues", label: "Continues until terminated" }}
        />
        <TermChoice
          label="Term of Confidentiality"
          name="confidentialityType"
          value={data.confidentialityType}
          onChange={(v) => set("confidentialityType", v)}
          years={data.confidentialityYears}
          onYearsChange={(n) => set("confidentialityYears", n)}
          yearsOption={{
            value: "years",
            after: "year(s) from Effective Date",
            inputLabel: "Confidentiality term in years",
          }}
          otherOption={{ value: "perpetual", label: "In perpetuity" }}
        />
        <TextField
          id="governingLaw"
          label="Governing Law (state)"
          placeholder="e.g. Delaware"
          value={data.governingLaw}
          onChange={(v) => set("governingLaw", v)}
        />
        <TextField
          id="jurisdiction"
          label="Jurisdiction (city or county and state of the courts)"
          placeholder="e.g. New Castle, DE"
          value={data.jurisdiction}
          onChange={(v) => set("jurisdiction", v)}
        />
        <TextField
          id="modifications"
          label="MNDA Modifications (optional)"
          rows={2}
          value={data.modifications}
          onChange={(v) => set("modifications", v)}
        />
      </Section>

      {PARTY_KEYS.map((key, i) => (
        <Section key={key} title={`Party ${i + 1}`}>
          {PARTY_FIELDS.map(({ field, label }) => (
            <TextField
              key={field}
              id={`${key}-${field}`}
              label={label}
              value={data[key][field]}
              onChange={(v) => setParty(key, field, v)}
            />
          ))}
        </Section>
      ))}
    </form>
  );
}
