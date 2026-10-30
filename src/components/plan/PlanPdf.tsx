import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { money } from "@/lib/campaign/catalog";
import type { CampaignPlan } from "@/lib/campaign/plan";
import type { PitchDraft } from "@/lib/campaign/types";

/** Design is authored in CSS pixels on a 794px-wide page; A4 is 595pt wide. */
const px = (n: number) => n * 0.75;

const C = {
  paper: "#fbf9f4",
  ink: "#191a16",
  soft: "#4f4f47",
  faint: "#6b685e",
  line: "#e2dccd",
  forest: "#1f3d2b",
  lavenderSoft: "#ebe6fa",
  lavenderDeep: "#54468f",
};

let registered = false;
export function registerFonts(origin: string) {
  if (registered) return;
  Font.register({
    family: "Inter Tight",
    fonts: [
      { src: `${origin}/fonts/InterTight-400.woff`, fontWeight: 400 },
      { src: `${origin}/fonts/InterTight-500.woff`, fontWeight: 500 },
      { src: `${origin}/fonts/InterTight-600.woff`, fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Instrument Serif",
    fonts: [{ src: `${origin}/fonts/InstrumentSerif-Regular.woff`, fontStyle: "normal" }],
  });
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.paper,
    color: C.ink,
    fontFamily: "Inter Tight",
    fontSize: px(14),
    paddingTop: px(56),
    paddingBottom: px(72),
    paddingHorizontal: px(64),
  },
  h2: { fontSize: px(16), fontWeight: 600, marginBottom: px(10) },
  small: { fontSize: px(12), lineHeight: 1.5, color: C.soft },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.6,
    borderBottomColor: C.line,
    paddingVertical: px(8),
  },
  footer: {
    position: "absolute",
    left: px(64),
    right: px(64),
    bottom: px(32),
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: px(10.5),
    lineHeight: 1.4,
    color: C.faint,
  },
});

export interface PlanPdfProps {
  brand: string;
  domain: string;
  plan: CampaignPlan;
  pitches: { name: string; detail: string; pitch: PitchDraft }[];
  isDemo: boolean;
}

export function PlanPdf({ brand, domain, plan, pitches, isDemo }: PlanPdfProps) {
  const total = plan.lines.reduce((sum, l) => sum + l.amount, 0) + plan.reserve + plan.unallocated;
  return (
    <Document title={`${plan.name}: campaign plan`} author={brand} creator="Reppl">
      <Page size="A4" style={s.page}>
        <Text style={{ fontSize: px(12), color: C.faint }}>{domain}</Text>
        <Text style={{ marginTop: px(40), fontFamily: "Instrument Serif", fontSize: px(56), lineHeight: 1, letterSpacing: px(-1) }}>
          {plan.name}
        </Text>
        <Text style={{ marginTop: px(16), fontSize: px(17), lineHeight: 1.45, color: C.soft, maxWidth: px(560) }}>{plan.objective}</Text>
        {plan.decisionBrief?.mode === "conditional" && <Text style={[s.small, { marginTop: px(16) }]}>Conditional scenario: availability, prices or evidence may still need confirmation. This is not a booking commitment.</Text>}
        {plan.idea && (
          <View style={{ marginTop: px(24), padding: px(18), backgroundColor: C.lavenderSoft, borderRadius: px(14), maxWidth: px(620) }}>
            <Text style={{ fontSize: px(11.5), color: C.lavenderDeep, fontWeight: 500 }}>{`Campaign idea · ${plan.idea.format}`}</Text>
            <Text style={{ marginTop: px(6), fontFamily: "Instrument Serif", fontSize: px(26), lineHeight: 1.1 }}>{plan.idea.title}</Text>
            <Text style={{ marginTop: px(6), fontSize: px(13), lineHeight: 1.5, color: C.soft }}>{plan.idea.pitch}</Text>
          </View>
        )}
        {isDemo && (
          <Text
            style={{
              marginTop: px(20),
              alignSelf: "flex-start",
              backgroundColor: C.lavenderSoft,
              color: C.lavenderDeep,
              borderRadius: px(12),
              paddingVertical: px(5),
              paddingHorizontal: px(12),
              fontSize: px(11),
              lineHeight: 1.3,
            }}
          >
            This plan includes illustrative partners, audience figures or costs. Commercial availability is unverified.
          </Text>
        )}

        <View style={{ marginTop: px(44), flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ width: px(380) }}>
            <Text style={s.h2}>Suggested budget</Text>
            {plan.lines.map((l) => (
              <View key={l.id} style={s.row}>
                <View>
                  <Text>{l.name}</Text>
                  <Text style={{ fontSize: px(12), color: C.faint, marginTop: px(2) }}>{l.format}</Text>
                </View>
                <Text>{money(l.amount)}</Text>
              </View>
            ))}
            <View style={s.row}>
              <Text>Reserve</Text>
              <Text>{money(plan.reserve)}</Text>
            </View>
            {plan.unallocated > 0 && (
              <View style={s.row}>
                <Text>Not yet allocated</Text>
                <Text>{money(plan.unallocated)}</Text>
              </View>
            )}
            <View style={[s.row, { borderBottomWidth: 0 }]}>
              <Text style={{ fontWeight: 600 }}>Total</Text>
              <Text style={{ fontWeight: 600 }}>{money(total)}</Text>
            </View>
          </View>
          <View style={{ width: px(240) }}>
            <Text style={s.h2}>Timeline</Text>
            {plan.timeline.map((t, i) => (
              <View key={`${t.when}-${i}`} style={{ marginBottom: px(10) }}>
                <Text style={{ fontSize: px(12), color: C.faint }}>{t.when}</Text>
                <Text style={{ fontSize: px(13), lineHeight: 1.4, marginTop: px(2) }}>{t.what}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginTop: px(28) }}>
          <Text style={s.h2}>How you&rsquo;ll know it worked</Text>
          {plan.measures.map((m) => (
            <Text key={m} style={[s.small, { marginBottom: px(4) }]}>
              {`•  ${m}`}
            </Text>
          ))}
        </View>
        <Footer brand={brand} />
      </Page>

      {plan.decisionBrief && <Page size="A4" style={s.page}>
        <Text style={s.h2}>Sponsorship decision brief</Text>
        {plan.decisionBrief.selectedIds && <Text style={s.small}>Your selected shortlist: {plan.decisionBrief.selectedIds.map(id => plan.decisionBrief!.names[id]).join(", ") || "None"}. The recommendation and baseline below are comparisons.</Text>}
        <Text style={s.small}>Recommended: {plan.decisionBrief.portfolio.recommended.ids.map(id => plan.decisionBrief!.names[id]).join(", ") || "No eligible priced portfolio"}</Text>
        <Text style={s.small}>Estimated commitment {money(plan.decisionBrief.portfolio.recommended.totalCost)}; remaining {money(plan.decisionBrief.portfolio.recommended.remaining)}.</Text>
        <Text style={s.small}>Individual-ranking baseline: {plan.decisionBrief.portfolio.baseline.ids.map(id => plan.decisionBrief!.names[id]).join(", ") || "None"}; cost {money(plan.decisionBrief.portfolio.baseline.totalCost)}; score {plan.decisionBrief.portfolio.baseline.score}. Recommendation score: {plan.decisionBrief.portfolio.recommended.score}.</Text>
        <Text style={s.small}>{plan.decisionBrief.portfolio.method}</Text>
        {plan.decisionBrief.portfolio.assumptions.map(a => <Text key={a} style={[s.small, { marginTop: px(8) }]}>{a}</Text>)}
        {plan.decisionBrief.portfolio.decisions.map(d => <View key={d.id} style={{ marginTop: px(16) }}>
          <Text style={{ fontWeight: 600 }}>{plan.decisionBrief!.names[d.id]}: {d.selected ? "Selected" : "Not selected"}</Text>
          <Text style={s.small}>{d.reason}</Text>
          <Text style={s.small}>{d.unknowns.join(" ")}</Text>
          {d.evidence?.map(e => <Text key={e} style={s.small}>{e}</Text>)}
        </View>)}
        <Footer brand={brand} />
      </Page>}

      {pitches.map((p) => (
        <Page key={p.name} size="A4" style={s.page}>
          <Text style={{ fontSize: px(12), color: C.faint }}>Pitch</Text>
          <Text style={{ marginTop: px(6), fontFamily: "Instrument Serif", fontSize: px(36), lineHeight: 1.05 }}>{p.name}</Text>
          <Text style={{ marginTop: px(4), fontSize: px(12), color: C.faint }}>{p.detail}</Text>
          <View style={{ marginTop: px(28), paddingTop: px(16), borderTopWidth: 0.6, borderTopColor: C.line }}>
            <Text style={{ fontSize: px(12), color: C.faint }}>Subject</Text>
            <Text style={{ marginTop: px(4), fontSize: px(15), fontWeight: 500 }}>{p.pitch.subject}</Text>
          </View>
          <Text style={{ marginTop: px(22), fontSize: px(14), lineHeight: 1.6, color: C.ink }}>{p.pitch.body}</Text>
          <Footer brand={brand} />
        </Page>
      ))}
    </Document>
  );
}

function Footer({ brand }: { brand: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{`${brand} · prepared with Reppl`}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
    </View>
  );
}
