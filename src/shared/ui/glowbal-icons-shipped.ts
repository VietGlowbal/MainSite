/**
 * GLOWBAL shipped icons — the 27 that first shipped as PNG sheets, redrawn as
 * two-tone vectors on the icon plan's system (24px box, 1.8px stroke, ink shape
 * plus one accent detail) and approved by the owner on 2026-09-15 on the review
 * canvas "GlowBal Icon Redraw".
 *
 * Kept apart from glowbal-icons.ts because that file is generated from the plan
 * and must stay regenerable; glowbal-icon-art.ts merges the two. Same element
 * shape, so <GlowbalIcon> renders both sets identically.
 *
 * Where the redraw departs from the PNG, on purpose: the set has no fills, so the
 * originals' filled details (badges, the planner cell, the pencil) are outlines;
 * Status View keeps one accent dot, not three status colours; Calendar View drops
 * the row rule and Personal Report its text lines, both of which clogged the
 * glyph solid below 32px.
 */

import type { IconElement } from './glowbal-icons';

export const GLOWBAL_SHIPPED_ICONS = {
  /** Home — was home.png in the shipped sheets (Feature 1: site & portal) */
  home: [
    { t: 'path', tone: 'ink', d: 'M3.5 10.5 12 3.8l8.5 6.7v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z' },
    { t: 'path', tone: 'accent', d: 'M9.6 20.5v-4.3a2.4 2.4 0 0 1 4.8 0v4.3' },
  ],
  /** GlowBal News — was glowbal-news.png in the shipped sheets (Feature 1: site & portal) */
  glowbalNews: [
    { t: 'rect', tone: 'ink', x: 4, y: 3, width: 16, height: 18 },
    { t: 'path', tone: 'accent', d: 'M7.2 6.6h4v4h-4z' },
    { t: 'path', tone: 'ink', d: 'M14.2 7.2h2.6M14.2 10h2.6M7.2 14h9.6M7.2 17.2h6.4' },
  ],
  /** Search — was search.png in the shipped sheets (Feature 1: site & portal) */
  search: [
    { t: 'circle', tone: 'ink', cx: 10.5, cy: 10.5, r: 6.8 },
    { t: 'path', tone: 'accent', d: 'M15.6 15.6 20.5 20.5' },
  ],
  /** Universities — was universities.png in the shipped sheets (Feature 1: site & portal) */
  universities: [
    { t: 'path', tone: 'ink', d: 'M3 10.5h18L12 3.5z' },
    { t: 'circle', tone: 'accent', cx: 12, cy: 7.5, r: 1 },
    { t: 'path', tone: 'ink', d: 'M6 13.5V18M10 13.5V18M14 13.5V18M18 13.5V18' },
    { t: 'path', tone: 'ink', d: 'M3 20.8h18' },
  ],
  /** Scholarships — was scholarships.png in the shipped sheets (Feature 1: site & portal) */
  scholarships: [
    { t: 'path', tone: 'ink', d: 'M2.5 9 12 4.5 21.5 9 12 13.5z' },
    { t: 'path', tone: 'ink', d: 'M6.5 11.3v4.4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.4' },
    { t: 'path', tone: 'accent', d: 'M12 9l7.5 1.6v5.2' },
    { t: 'circle', tone: 'accent', cx: 19.5, cy: 17.6, r: 1.5 },
  ],
  /** Advisors — was advisors.png in the shipped sheets (Feature 1: site & portal) */
  advisors: [
    { t: 'circle', tone: 'ink', cx: 9, cy: 7.5, r: 3.3 },
    { t: 'path', tone: 'accent', d: 'M2.8 20.5c0-3.8 2.8-6.3 6.2-6.3s6.2 2.5 6.2 6.3' },
    { t: 'circle', tone: 'ink', cx: 17, cy: 9, r: 2.5 },
    { t: 'path', tone: 'ink', d: 'M17.4 14.3c2.3.2 3.8 2.3 3.8 5.2' },
  ],
  /** Plan Global Education — was plan-global-education.png in the shipped sheets (Feature 1: site & portal) */
  planGlobalEducation: [
    { t: 'circle', tone: 'ink', cx: 10.5, cy: 13.5, r: 7 },
    { t: 'path', tone: 'ink', d: 'M6.2 9.4c1.2.5 1.8 1.4 1.6 2.6-.2 1.2.7 1.9 1.8 2.3 1 .4 1.2 1.4.6 2.4' },
    { t: 'path', tone: 'accent', d: 'M3 19.8C8.8 19 15.6 13.8 20.4 3.8' },
    { t: 'path', tone: 'accent', d: 'M16.4 4.8 21 3l-.8 4.9' },
  ],
  /** My Portal — was my-portal.png in the shipped sheets (Feature 1: site & portal) */
  myPortal: [
    { t: 'rect', tone: 'ink', x: 3.5, y: 3.5, width: 7, height: 7 },
    { t: 'rect', tone: 'accent', x: 13.5, y: 3.5, width: 7, height: 7 },
    { t: 'rect', tone: 'ink', x: 3.5, y: 13.5, width: 7, height: 7 },
    { t: 'rect', tone: 'ink', x: 13.5, y: 13.5, width: 7, height: 7 },
  ],
  /** My Application — was my-application.png in the shipped sheets (Feature 1: site & portal) */
  myApplication: [
    { t: 'rect', tone: 'ink', x: 5, y: 3, width: 14, height: 18 },
    { t: 'path', tone: 'accent', d: 'M8.5 7.8h7' },
    { t: 'path', tone: 'ink', d: 'M8.5 11.6h7M8.5 15.2h7M8.5 18.4h4' },
  ],
  /** Saved Universities — was saved-universities.png in the shipped sheets (Feature 1: site & portal) */
  savedUniversities: [
    { t: 'path', tone: 'ink', d: 'M6 20.5V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15.5' },
    { t: 'path', tone: 'accent', d: 'M6 20.5l6-5.2 6 5.2' },
  ],
  /** User Profile — was user-profile.png in the shipped sheets (Feature 1: site & portal) */
  userProfile: [
    { t: 'circle', tone: 'accent', cx: 12, cy: 8, r: 4.2 },
    { t: 'path', tone: 'ink', d: 'M4 21c0-4.2 3.6-7.2 8-7.2s8 3 8 7.2' },
  ],
  /** How GlowBal Works — was how-glowbal-works.png in the shipped sheets (Feature 1: site & portal) */
  howGlowbalWorks: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'ink', d: 'M9.4 9.4a2.7 2.7 0 1 1 3.8 2.5c-.7.3-1.2.9-1.2 1.7v.4' },
    { t: 'path', tone: 'accent', d: 'M12 17h.01' },
  ],
  /** Strategy Master — was strategy-master.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  strategyMaster: [
    { t: 'path', tone: 'ink', d: 'M9.6 17.2c-.2-1.1-.8-1.9-1.6-2.7a5 5 0 1 1 8 0c-.8.8-1.4 1.6-1.6 2.7z' },
    { t: 'path', tone: 'ink', d: 'M9.8 19.6h4.4M10.8 21.8h2.4' },
    { t: 'path', tone: 'accent', d: 'M12 2.3v1.6M5.2 5l1.2 1.2M18.8 5l-1.2 1.2M2.6 11.5h1.7M19.7 11.5h1.7' },
    { t: 'path', tone: 'accent', d: 'M12 9.3l.75 1.5 1.65.25-1.2 1.15.3 1.65-1.5-.8-1.5.8.3-1.65-1.2-1.15 1.65-.25z' },
  ],
  /** Reflection — was reflection.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  reflection: [
    { t: 'circle', tone: 'ink', cx: 8, cy: 10.8, r: 3 },
    { t: 'path', tone: 'ink', d: 'M2.5 21c0-3.3 2.5-5.6 5.5-5.6s5.5 2.3 5.5 5.6' },
    { t: 'path', tone: 'accent', d: 'M12 2.8h9.8v7h-4.6l-2.7 2.4V9.8H12z' },
    { t: 'path', tone: 'accent', d: 'M14.4 6.3h.01M16.9 6.3h.01M19.4 6.3h.01' },
    { t: 'circle', tone: 'ink', cx: 12.4, cy: 13.6, r: 0.5 },
  ],
  /** Personal Report — was personal-report.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  personalReport: [
    { t: 'path', tone: 'ink', d: 'M5 3h9l5 5v13H5z' },
    { t: 'path', tone: 'ink', d: 'M14 3v5h5' },
    { t: 'circle', tone: 'ink', cx: 9.5, cy: 8.5, r: 1.9 },
    { t: 'path', tone: 'ink', d: 'M6.8 13.4c.4-1.4 1.4-2.1 2.7-2.1s2.3.7 2.7 2.1' },
    { t: 'path', tone: 'accent', d: 'M9 18.5v-1.6M12 18.5v-3.4M15 18.5v-5.2' },
  ],
  /** Matching Report — was matching-report.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  matchingReport: [
    { t: 'path', tone: 'ink', d: 'M16.5 10.3V7.5L12 3H4.5v18h7' },
    { t: 'path', tone: 'ink', d: 'M12 3v4.5h4.5' },
    { t: 'path', tone: 'ink', d: 'M7.5 8H10M7.5 11h5' },
    { t: 'path', tone: 'accent', d: 'M8 18v-2.2M10.8 18v-4.4' },
    { t: 'circle', tone: 'ink', cx: 16.5, cy: 16, r: 3.2 },
    { t: 'path', tone: 'ink', d: 'M18.8 18.3 21.2 20.7' },
  ],
  /** Personalized Strategy — was personalized-strategy.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  personalizedStrategy: [
    { t: 'circle', tone: 'ink', cx: 11, cy: 13, r: 8 },
    { t: 'circle', tone: 'ink', cx: 11, cy: 13, r: 4.2 },
    { t: 'path', tone: 'accent', d: 'M11 13 18.2 5.8' },
    { t: 'path', tone: 'accent', d: 'M18.2 5.8V3M18.2 5.8H21' },
  ],
  /** Application Planner — was application-planner.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  applicationPlanner: [
    { t: 'path', tone: 'ink', d: 'M12.5 20H4.5A1.5 1.5 0 0 1 3 18.5v-12A1.5 1.5 0 0 1 4.5 5h12A1.5 1.5 0 0 1 18 6.5V11' },
    { t: 'path', tone: 'ink', d: 'M7 3v4M14 3v4' },
    { t: 'path', tone: 'ink', d: 'M6.5 10.5h.01M9.5 10.5h.01M12.5 10.5h.01M6.5 14h.01M9.5 14h.01' },
    { t: 'circle', tone: 'accent', cx: 17, cy: 17, r: 4 },
    { t: 'path', tone: 'accent', d: 'M17 15v2.2l1.4.9' },
  ],
  /** List View — was list-view.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  listView: [
    { t: 'path', tone: 'accent', d: 'M3.5 4.5h3.6v3.6H3.5z' },
    { t: 'path', tone: 'ink', d: 'M3.5 10.2h3.6v3.6H3.5zM3.5 15.9h3.6v3.6H3.5z' },
    { t: 'path', tone: 'ink', d: 'M10.5 6.3h10M10.5 12h10M10.5 17.7h10' },
  ],
  /** Status View — was status-view.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  statusView: [
    { t: 'circle', tone: 'ink', cx: 5.5, cy: 5.5, r: 1.6 },
    { t: 'circle', tone: 'ink', cx: 5.5, cy: 12, r: 1.6 },
    { t: 'circle', tone: 'accent', cx: 5.5, cy: 18.5, r: 1.6 },
    { t: 'path', tone: 'ink', d: 'M10 5.5h10.5M10 12h10.5M10 18.5h10.5' },
  ],
  /** Calendar View — was calendar-view.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  calendarView: [
    { t: 'rect', tone: 'ink', x: 3, y: 5, width: 18, height: 16 },
    { t: 'path', tone: 'ink', d: 'M3 10h18M8 3v4M16 3v4' },
    { t: 'path', tone: 'ink', d: 'M9 10v11M15 10v11' },
    { t: 'path', tone: 'accent', d: 'M11.2 14.3h1.6v1.7h-1.6z' },
  ],
  /** Profile Support — was profile-support.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  profileSupport: [
    { t: 'circle', tone: 'ink', cx: 9, cy: 7.5, r: 3.4 },
    { t: 'path', tone: 'ink', d: 'M2.5 20.5c0-3.8 2.9-6.3 6.5-6.3 1.2 0 2.3.3 3.2.8' },
    { t: 'circle', tone: 'accent', cx: 17, cy: 17, r: 2.6 },
    { t: 'path', tone: 'accent', d: 'M17 12.6v1.2M17 20.2v1.2M12.6 17h1.2M20.2 17h1.2M13.9 13.9l.85.85M19.25 19.25l.85.85M13.9 20.1l.85-.85M19.25 14.75l.85-.85' },
  ],
  /** Essay Support — was essay-support.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  essaySupport: [
    { t: 'path', tone: 'ink', d: 'M11 21H5V3h8.5L18 7.5V10' },
    { t: 'path', tone: 'ink', d: 'M13.5 3v4.5H18' },
    { t: 'path', tone: 'ink', d: 'M8 11h6M8 14.5h3.5' },
    { t: 'path', tone: 'accent', d: 'M12.5 21l.6-2.8 6-6a1.6 1.6 0 0 1 2.2 2.2l-6 6z' },
  ],
  /** CV Support — was cv-support.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  cvSupport: [
    { t: 'path', tone: 'ink', d: 'M11.5 21H5V3h9l5 5v3.5' },
    { t: 'path', tone: 'ink', d: 'M14 3v5h5' },
    { t: 'path', tone: 'ink', d: 'M10.1 10.65a1.9 1.9 0 1 0 0 2.7' },
    { t: 'path', tone: 'ink', d: 'M11.3 10.4l1.2 3.4 1.2-3.4' },
    { t: 'path', tone: 'ink', d: 'M7.5 17.2H11' },
    { t: 'circle', tone: 'accent', cx: 17, cy: 17, r: 4 },
    { t: 'path', tone: 'accent', d: 'M17 19v-4M15.4 16.6 17 15l1.6 1.6' },
  ],
  /** LOR Support — was lor-support.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  lorSupport: [
    { t: 'path', tone: 'ink', d: 'M11.5 21H5V3h9l5 5v4' },
    { t: 'path', tone: 'ink', d: 'M14 3v5h5' },
    { t: 'path', tone: 'ink', d: 'M8 8h3.5M8 11h6' },
    { t: 'circle', tone: 'ink', cx: 9, cy: 14.8, r: 1.5 },
    { t: 'path', tone: 'ink', d: 'M6.8 19.2c.3-1.2 1.1-1.9 2.2-1.9s1.9.7 2.2 1.9' },
    { t: 'rect', tone: 'accent', x: 13, y: 14.5, width: 8.5, height: 6 },
    { t: 'path', tone: 'accent', d: 'M13.3 15.2l4.45 3 4.45-3' },
  ],
  /** Documents — was documents.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  documents: [
    { t: 'path', tone: 'ink', d: 'M9.5 6V3h6.5l4 4v3.5' },
    { t: 'path', tone: 'ink', d: 'M14 21H5V6h8l4 4v2' },
    { t: 'path', tone: 'ink', d: 'M13 6v4h4' },
    { t: 'path', tone: 'ink', d: 'M7.8 13h4M7.8 16h3.5' },
    { t: 'path', tone: 'accent', d: 'M19.5 13.5v5.2a2.2 2.2 0 0 1-4.4 0v-4.4a1.1 1.1 0 0 1 2.2 0v4' },
  ],
  /** Final Evaluation — was final-evaluation.png in the shipped sheets (Feature 2: Strategy Master & workspace) */
  finalEvaluation: [
    { t: 'path', tone: 'ink', d: 'M11 21H5.5A1.5 1.5 0 0 1 4 19.5v-13A1.5 1.5 0 0 1 5.5 5H7M15 5h1.5A1.5 1.5 0 0 1 18 6.5V11' },
    { t: 'rect', tone: 'ink', x: 7.5, y: 3, width: 7, height: 3.5 },
    { t: 'path', tone: 'ink', d: 'M7 11l1.2 1.2 2.2-2.2M7 15.8l1.2 1.2 2.2-2.2' },
    { t: 'path', tone: 'ink', d: 'M12.5 11h3' },
    { t: 'circle', tone: 'accent', cx: 17, cy: 17.2, r: 4 },
    { t: 'path', tone: 'accent', d: 'M17 15.3l.6 1.2 1.3.2-.95.9.22 1.3-1.17-.6-1.17.6.22-1.3-.95-.9 1.3-.2z' },
  ],
} as const satisfies Record<string, readonly IconElement[]>;
