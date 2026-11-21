import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
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
import { COLORS } from "@/lib/theme";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Times-Roman", lineHeight: 1.4, color: "#222222" },
  title: { fontSize: 18, lineHeight: 1.2, fontFamily: "Times-Bold", color: COLORS.navy, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 9, color: COLORS.muted, textAlign: "center", marginBottom: 14 },
  paragraph: { marginBottom: 10 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 2 },
  section: { marginBottom: 8 },
  bold: { fontFamily: "Times-Bold" },
  term: { textDecoration: "underline" },
  table: { marginTop: 6, borderTopWidth: 1, borderTopColor: COLORS.navy },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#cccccc", minHeight: 24 },
  labelCell: { width: "24%", padding: 4, color: COLORS.muted },
  cell: { width: "38%", padding: 4 },
  headerCell: { width: "38%", padding: 4, fontFamily: "Times-Bold", color: COLORS.navy },
  clause: { marginBottom: 6, textAlign: "justify" },
  attribution: { marginTop: 8, fontSize: 8, color: COLORS.muted },
});

function CoverSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <Text>{children}</Text>
    </View>
  );
}

function renderSegment(segment: Segment, data: NdaData, key: number) {
  switch (segment.kind) {
    case "text":
      return segment.text;
    case "bold":
      return (
        <Text key={key} style={styles.bold}>
          {segment.text}
        </Text>
      );
    case "term": {
      const value = resolveTerm(segment.term, data);
      return value === undefined ? (
        <Text key={key} style={styles.term}>
          {segment.term}
        </Text>
      ) : (
        <Text key={key} style={styles.bold}>
          {valueOrPlaceholder(value, segment.term)}
        </Text>
      );
    }
  }
}

export function NdaDocument({ data, terms }: { data: NdaData; terms: StandardTerms }) {
  return (
    <Document title="Mutual Non-Disclosure Agreement" creator="Prelegal">
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Mutual Non-Disclosure Agreement</Text>
        <Text style={styles.subtitle}>Cover Page</Text>
        <Text style={styles.paragraph}>
          This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“
          <Text style={styles.bold}>Cover Page</Text>”) and (2) the Common Paper Mutual NDA Standard Terms Version
          1.0 (“<Text style={styles.bold}>Standard Terms</Text>”). Any modifications of the Standard Terms should be
          made on the Cover Page, which will control over conflicts with the Standard Terms.
        </Text>

        <CoverSection title="Purpose">{valueOrPlaceholder(data.purpose, "Purpose")}</CoverSection>
        <CoverSection title="Effective Date">
          {valueOrPlaceholder(formatDate(data.effectiveDate), "Effective Date")}
        </CoverSection>
        <CoverSection title="MNDA Term">{describeMndaTerm(data)}</CoverSection>
        <CoverSection title="Term of Confidentiality">{describeConfidentiality(data)}</CoverSection>
        <CoverSection title="Governing Law & Jurisdiction">
          {`Governing Law: ${valueOrPlaceholder(data.governingLaw, "Governing Law")}\n`}
          {`Jurisdiction: courts located in ${valueOrPlaceholder(data.jurisdiction, "Jurisdiction")}`}
        </CoverSection>
        <CoverSection title="MNDA Modifications">{data.modifications.trim() || "None."}</CoverSection>

        <Text style={styles.paragraph}>
          By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.
        </Text>

        <View style={styles.table} wrap={false}>
          <View style={styles.row}>
            <Text style={styles.labelCell} />
            <Text style={styles.headerCell}>PARTY 1</Text>
            <Text style={styles.headerCell}>PARTY 2</Text>
          </View>
          {SIGNATURE_ROWS.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.labelCell}>{row.label}</Text>
              <Text style={styles.cell}>{row.value(data.party1)}</Text>
              <Text style={styles.cell}>{row.value(data.party2)}</Text>
            </View>
          ))}
        </View>
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Standard Terms</Text>
        <View style={{ marginTop: 10 }}>
          {terms.clauses.map((clause) => (
            <Text key={clause.number} style={styles.clause}>
              {`${clause.number}. `}
              <Text style={styles.bold}>{clause.title}</Text>
              {". "}
              {clause.segments.map((segment, i) => renderSegment(segment, data, i))}
            </Text>
          ))}
        </View>
        <Text style={styles.attribution}>{terms.attribution}</Text>
      </Page>
    </Document>
  );
}

/** Render the completed MNDA to a PDF blob. */
export function renderNdaPdf(data: NdaData, terms: StandardTerms): Promise<Blob> {
  return pdf(<NdaDocument data={data} terms={terms} />).toBlob();
}
