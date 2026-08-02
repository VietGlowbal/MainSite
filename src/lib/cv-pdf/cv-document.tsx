import { Document, Font, Page, Text, View } from '@react-pdf/renderer';
import {
  applyLayoutOrder,
  cvLayout,
  isEmphasised,
  sectionTitle,
  type CvEntry,
  type CvLayoutKey,
  type CvSection,
  type StructuredCv,
} from '@/features/application-strategy/domain';
import { pdfStyles } from './styles';

/**
 * The CV, rendered to PDF.
 *
 * WHY ONE COMPONENT AND NOT THREE. The design sketched one document file per
 * layout. That was the wrong shape: three files would be near-identical, the
 * second would be a copy of the first, and the difference between them would decay
 * into the heading order. Because a layout is already DATA — a section order, an
 * emphasis set, a column count — one renderer consuming that data produces output
 * that genuinely differs while there is only one place for a pagination or
 * contrast bug to live. A test asserts the three orders are pairwise distinct, so
 * "genuinely different" stays enforced.
 *
 * WHAT EMPHASIS DOES HERE. An emphasised section prints every bullet and its
 * evidence line. A de-emphasised one prints the title, the organisation and the
 * dates, and drops the bullets. That is what makes the same content read as an
 * academic CV or a technical one rather than merely being ordered differently: on
 * the technical layout, Skills and Projects get the detail and Education becomes
 * three compact lines.
 *
 * PAGINATION. `wrap={false}` on an entry keeps a role and its bullets together —
 * an entry split across a page break is the single most common way a generated CV
 * looks broken. Sections themselves are allowed to break, because a section with
 * eight entries has to.
 */

/**
 * Turn off hyphenation.
 *
 * `@react-pdf/renderer` hyphenates by default, which broke a section heading in
 * the narrow sidebar column into "ACTIVITIES AND LEAD- ERSHIP". That is not a
 * cosmetic quibble on a CV: a reader who sees a broken word assumes the document
 * was generated carelessly, and an applicant tracking system indexing
 * "LEAD-ERSHIP" has lost the word entirely.
 *
 * The callback returns the word as a single-element array, which is the documented
 * way to say "never split". Registered at module scope because it is global to the
 * renderer, and idempotent, so importing this module twice is harmless.
 */
Font.registerHyphenationCallback((word) => [word]);

export type CvPdfProps = {
  layout: CvLayoutKey;
  cv: Pick<StructuredCv, 'sections'>;
  /** Falls back to the contact section, then to a neutral title. */
  candidateName?: string | null | undefined;
};

export function CvDocument({ layout, cv, candidateName }: CvPdfProps) {
  const def = cvLayout(layout);
  const ordered = applyLayoutOrder(cv.sections, layout).filter((section) =>
    section.entries.some(hasContent),
  );

  const contact = ordered.find((section) => section.kind === 'contact');
  const body = ordered.filter((section) => section.kind !== 'contact');

  const name = candidateName?.trim() || nameFromContact(contact) || 'Curriculum Vitae';
  const contactLines = contactValues(contact);

  return (
    <Document
      title={`${name} — CV`}
      author={name}
      /*
       * A real PDF outline and language, because this file is read by software as
       * well as by people: applicant tracking systems and screen readers both use
       * them, and both are part of the audience for a CV.
       */
      creator="Glowbal"
      producer="Glowbal"
      language="en"
    >
      <Page size="A4" style={pdfStyles.page} wrap>
        <View style={pdfStyles.header}>
          {/*
            The trailing newline is not decorative. Without it the extracted text
            layer reads "Nguyen Minh Anhminhanh@example.com" — the name and the
            first contact value run together as one token, because adjacent text
            runs get no separator. An ATS parsing that string finds neither a name
            nor an email. Selectable, correctly-tokenised text is the requirement
            here, so the separator is explicit.
          */}
          <Text style={pdfStyles.name}>{`${name} `}</Text>
          {contactLines.length > 0 ? (
            <View style={pdfStyles.contactRow}>
              {contactLines.map((line, index) => (
                <Text key={`contact-${index}`} style={pdfStyles.contactItem}>
                  {line}
                  {index < contactLines.length - 1 ? '  · ' : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {def.columns === 2 ? (
          <TwoColumnBody layout={layout} sections={body} />
        ) : (
          <SingleColumnBody layout={layout} sections={body} />
        )}

        <Text
          style={pdfStyles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${name} — page ${pageNumber} of ${totalPages}` : ''
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function SingleColumnBody({ layout, sections }: { layout: CvLayoutKey; sections: CvSection[] }) {
  return (
    <View>
      {sections.map((section) => (
        <SectionBlock key={section.id} layout={layout} section={section} />
      ))}
    </View>
  );
}

/**
 * Two columns: emphasised sections in the main column, the rest in the sidebar.
 *
 * Driven by the layout's own emphasis set rather than by a separate list of
 * "sidebar sections", so there is one definition of what a layout considers
 * important and the two cannot disagree.
 */
function TwoColumnBody({ layout, sections }: { layout: CvLayoutKey; sections: CvSection[] }) {
  const main = sections.filter((section) => isEmphasised(layout, section.kind));
  const side = sections.filter((section) => !isEmphasised(layout, section.kind));

  // With nothing to put in it, a sidebar is a rule down the page and 150pt of
  // wasted width.
  if (side.length === 0) return <SingleColumnBody layout={layout} sections={sections} />;

  return (
    <View style={pdfStyles.columns}>
      <View style={pdfStyles.mainColumn}>
        {main.map((section) => (
          <SectionBlock key={section.id} layout={layout} section={section} />
        ))}
      </View>
      <View style={pdfStyles.sideColumn}>
        {side.map((section) => (
          <SectionBlock key={section.id} layout={layout} section={section} compact />
        ))}
      </View>
    </View>
  );
}

function SectionBlock({
  layout,
  section,
  compact,
}: {
  layout: CvLayoutKey;
  section: CvSection;
  compact?: boolean;
}) {
  const emphasised = isEmphasised(layout, section.kind);
  const entries = section.entries.filter(hasContent);
  if (entries.length === 0) return null;

  // Skills and interests are lists of words, not dated roles. Rendering them as
  // bullets wastes a third of the page on whitespace.
  const inline = section.kind === 'skills' || section.kind === 'interests';

  return (
    <View style={pdfStyles.section}>
      <Text style={emphasised ? pdfStyles.sectionHeading : pdfStyles.sectionHeadingMuted}>
        {sectionTitle(section)}
      </Text>

      {inline ? (
        <Text style={pdfStyles.inlineList}>
          {entries
            .flatMap((entry) => entry.bullets.filter((b) => b.trim().length > 0))
            .join(compact ? '\n' : ' · ')}
        </Text>
      ) : (
        entries.map((entry) => (
          <EntryBlock key={entry.id} entry={entry} detailed={emphasised && !compact} />
        ))
      )}
    </View>
  );
}

function EntryBlock({ entry, detailed }: { entry: CvEntry; detailed: boolean }) {
  const title = [entry.role, entry.organization].filter(nonEmpty).join(' — ');
  const dates = [entry.startDate, entry.current ? 'Present' : entry.endDate]
    .filter(nonEmpty)
    .join(' – ');
  const bullets = entry.bullets.filter((b) => b.trim().length > 0);

  if (!detailed) {
    // Compact: one line, no bullets. This is what makes a de-emphasised section
    // genuinely smaller rather than just lower down the page.
    return (
      <Text style={pdfStyles.compactLine}>
        {title || '—'}
        {dates ? ` (${dates})` : ''}
      </Text>
    );
  }

  return (
    /* An entry split across a page break is the commonest way a generated CV looks
       broken, so a whole entry moves to the next page rather than tearing. */
    <View style={pdfStyles.entry} wrap={false}>
      <View style={pdfStyles.entryHeaderRow}>
        <Text style={pdfStyles.entryTitle}>{title || '—'}</Text>
        {dates ? <Text style={pdfStyles.entryDates}>{dates}</Text> : null}
      </View>

      {entry.location?.trim() ? <Text style={pdfStyles.entryMeta}>{entry.location}</Text> : null}

      {bullets.map((bullet, index) => (
        <View key={`${entry.id}-b-${index}`} style={pdfStyles.bulletRow}>
          <Text style={pdfStyles.bulletMark}>•</Text>
          <Text style={pdfStyles.bulletText}>{bullet}</Text>
        </View>
      ))}

      {entry.evidence?.trim() ? <Text style={pdfStyles.evidence}>{entry.evidence}</Text> : null}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasContent(entry: CvEntry): boolean {
  return (
    [entry.organization, entry.role, entry.evidence].some(nonEmpty) ||
    entry.bullets.some((b) => b.trim().length > 0)
  );
}

/**
 * The contact section stores label/value pairs, so the name is whichever row is
 * labelled like a name.
 *
 * Falls through to the first value with no recognisable label, since a student who
 * typed their name with no label at all is the likeliest case of all.
 */
function nameFromContact(section: CvSection | undefined): string | null {
  if (!section) return null;
  const nameRow = section.entries.find((entry) =>
    /name|họ tên|tên/i.test(entry.role ?? ''),
  );
  if (nameRow?.organization?.trim()) return nameRow.organization.trim();

  const unlabelled = section.entries.find((entry) => !nonEmpty(entry.role) && nonEmpty(entry.organization));
  return unlabelled?.organization?.trim() ?? null;
}

/** Every contact row except the name, as "Label: value" or just the value. */
function contactValues(section: CvSection | undefined): string[] {
  if (!section) return [];
  return section.entries
    .filter((entry) => !/name|họ tên|tên/i.test(entry.role ?? ''))
    .map((entry) => {
      const value = entry.organization?.trim();
      if (!value) return null;
      const label = entry.role?.trim();
      // "Email: a@b.com" is noise; the value speaks for itself. A label is only
      // printed when it adds something a reader could not infer.
      const redundant = !label || /email|phone|tel|mobile|linkedin|github|website|address/i.test(label);
      return redundant ? value : `${label}: ${value}`;
    })
    .filter(nonEmpty)
    .slice(0, 6);
}
