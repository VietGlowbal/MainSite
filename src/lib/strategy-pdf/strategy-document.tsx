import { Document, Font, Page, Text, View } from '@react-pdf/renderer';
import type { StrategyRecommendationRecord } from '@/features/ai-strategy-dashboard/domain';
import { pdfStyles } from './styles';

/**
 * F7 Personalized Strategy, rendered to PDF.
 *
 * Same renderer choice as `lib/cv-pdf` (`@react-pdf/renderer`, not
 * `window.print()` or headless Chromium — see that module's header for why)
 * and the same hyphenation fix, registered again here rather than shared:
 * `Font.registerHyphenationCallback` is idempotent and global to the
 * renderer, so re-registering the same no-split behaviour in a second module
 * that does not import the first is the safe way to keep the two PDF
 * features independent.
 *
 * One page per section (`break` on each `View`) rather than a continuous
 * flow: this is a report meant to be skimmed section by section, not read
 * start to end like a CV, and a reader opening straight to "Roadmap" should
 * land on a clean page rather than mid-paragraph.
 */

Font.registerHyphenationCallback((word) => [word]);

export type StrategyPdfProps = {
  recommendation: Pick<
    StrategyRecommendationRecord,
    | 'directionOptions'
    | 'chosenDirection'
    | 'chosenDirectionWhy'
    | 'narrative'
    | 'positioningBefore'
    | 'positioningAfter'
    | 'positioningRationale'
    | 'portfolioEvaluations'
    | 'differentiationInsight'
    | 'differentiationProposal'
    | 'roadmap'
    | 'createdAt'
  >;
  candidateName?: string | null | undefined;
  programmeName?: string | null | undefined;
};

const RECOMMENDATION_TAG: Record<
  StrategyPdfProps['recommendation']['portfolioEvaluations'][number]['recommendation'],
  string
> = {
  highly_recommended: 'HIGHLY RECOMMENDED',
  recommended: 'RECOMMENDED',
  low_priority: 'LOW PRIORITY',
};

const SOURCE_LABEL: Record<
  StrategyPdfProps['recommendation']['portfolioEvaluations'][number]['source'],
  string
> = {
  existing_activity: 'In your portfolio',
  ai_proposed: 'Suggested opportunity',
};

export function StrategyDocument({ recommendation, candidateName, programmeName }: StrategyPdfProps) {
  const name = candidateName?.trim() || 'Personalized Strategy';
  const title = [name, programmeName].filter(Boolean).join(' — ');

  return (
    <Document title={`${title} — Personalized Strategy`} author={name} creator="Glowbal" producer="Glowbal" language="en">
      <Page size="A4" style={pdfStyles.page} wrap>
        <View style={pdfStyles.header}>
          <Text style={pdfStyles.title}>Personalized Strategy</Text>
          <Text style={pdfStyles.meta}>
            {[name, programmeName, formatDate(recommendation.createdAt)].filter(Boolean).join('  ·  ')}
          </Text>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionHeading}>Strategic Direction</Text>
          <Text style={pdfStyles.body}>{recommendation.chosenDirectionWhy}</Text>
          <View style={{ marginTop: 8 }}>
            {recommendation.directionOptions.map((option) => (
              <View
                key={option.name}
                style={option.name === recommendation.chosenDirection ? pdfStyles.cardChosen : pdfStyles.card}
              >
                <View style={pdfStyles.cardHeaderRow}>
                  <Text style={pdfStyles.cardHeading}>{option.name}</Text>
                  {option.name === recommendation.chosenDirection ? (
                    <Text style={pdfStyles.tag}>CHOSEN</Text>
                  ) : null}
                </View>
                <Text style={pdfStyles.bodyMuted}>Overall {option.overall.toFixed(1)}/10</Text>
                <View style={pdfStyles.dimensionGrid}>
                  <Dimension label="Identity fit" value={option.identityFit} />
                  <Dimension label="Evidence strength" value={option.evidenceStrength} />
                  <Dimension label="Consistency" value={option.consistency} />
                  <Dimension label="Differentiation" value={option.differentiation} />
                  <Dimension label="Future alignment" value={option.futureAlignment} />
                  <Dimension label="Scalability" value={option.scalability} />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionHeading}>Narrative Strategy</Text>
          <Text style={pdfStyles.body}>{recommendation.narrative}</Text>
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionHeading}>Positioning Strategy</Text>
          <View style={pdfStyles.card}>
            <Text style={pdfStyles.subHeading}>Before</Text>
            <Text style={pdfStyles.body}>{recommendation.positioningBefore}</Text>
          </View>
          <View style={pdfStyles.cardChosen}>
            <Text style={pdfStyles.subHeading}>After</Text>
            <Text style={pdfStyles.body}>{recommendation.positioningAfter}</Text>
          </View>
          <Text style={[pdfStyles.body, { marginTop: 4 }]}>{recommendation.positioningRationale}</Text>
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionHeading}>Portfolio Strategy</Text>
          {recommendation.portfolioEvaluations.map((item) => (
            <View key={item.name} style={pdfStyles.card} wrap={false}>
              <View style={pdfStyles.cardHeaderRow}>
                <Text style={pdfStyles.cardHeading}>{item.name}</Text>
                <Text style={pdfStyles.tag}>{RECOMMENDATION_TAG[item.recommendation]}</Text>
              </View>
              <Text style={pdfStyles.bodyMuted}>{SOURCE_LABEL[item.source]}</Text>
              <Text style={[pdfStyles.body, { marginTop: 2 }]}>{item.strategicContribution}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionHeading}>Differentiation Strategy</Text>
          <Text style={pdfStyles.subHeading}>The pattern you currently resemble</Text>
          <Text style={pdfStyles.body}>{recommendation.differentiationInsight}</Text>
          <Text style={[pdfStyles.subHeading, { marginTop: 8 }]}>How to stand out</Text>
          <Text style={pdfStyles.body}>{recommendation.differentiationProposal}</Text>
        </View>

        <View style={pdfStyles.section} break>
          <Text style={pdfStyles.sectionHeading}>Execution Roadmap</Text>
          <Text style={pdfStyles.subHeading}>{recommendation.roadmap.chosenStrategy}</Text>
          <Text style={pdfStyles.body}>{recommendation.roadmap.why}</Text>

          <Text style={[pdfStyles.subHeading, { marginTop: 10 }]}>Prioritize</Text>
          {recommendation.roadmap.prioritize.map((item) => (
            <View key={item} style={pdfStyles.bulletRow}>
              <Text style={pdfStyles.bulletMark}>+</Text>
              <Text style={pdfStyles.bulletText}>{item}</Text>
            </View>
          ))}

          <Text style={[pdfStyles.subHeading, { marginTop: 10 }]}>Avoid</Text>
          {recommendation.roadmap.avoid.map((item) => (
            <View key={item} style={pdfStyles.bulletRow}>
              <Text style={pdfStyles.bulletMark}>-</Text>
              <Text style={pdfStyles.bulletText}>{item}</Text>
            </View>
          ))}

          <Text style={[pdfStyles.subHeading, { marginTop: 10 }]}>Expected positioning</Text>
          <Text style={pdfStyles.body}>{recommendation.roadmap.expectedPositioning}</Text>

          <Text style={[pdfStyles.subHeading, { marginTop: 10 }]}>Long-term narrative</Text>
          <Text style={pdfStyles.body}>{recommendation.roadmap.longTermNarrative}</Text>
        </View>

        <Text
          style={pdfStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `${name} — page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

function Dimension({ label, value }: { label: string; value: number }) {
  return (
    <View style={pdfStyles.dimensionCell}>
      <Text style={pdfStyles.dimensionLabel}>{label}</Text>
      <Text style={pdfStyles.dimensionValue}>{value.toFixed(1)}/10</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
