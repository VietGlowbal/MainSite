/**
 * GLOWBAL icon art — 72 product icons, drawn on a 24px box with a 1.8px stroke.
 *
 * Generated from the icon plan; do not hand-edit individual coordinates — regenerate
 * from the plan document instead so the design record and the code stay in step.
 *
 * Every element carries a tone: 'ink' is the shape, 'accent' is the single detail
 * that names the function. <GlowbalIcon> maps the two tones onto the surface it
 * sits on, which is how one set of paths serves all four published variants
 * (ink, ink-red, white, white-red).
 */

export type IconElement =
  | { readonly t: 'path'; readonly tone: IconTone; readonly d: string }
  | { readonly t: 'circle'; readonly tone: IconTone; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly t: 'rect'; readonly tone: IconTone; readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type IconTone = 'ink' | 'accent';

export const GLOWBAL_ICON_BOX = 24;
export const GLOWBAL_ICON_STROKE = 1.8;

export const GLOWBAL_ICONS = {
  /** News Article — News list card, article header (group A: Public site) */
  newsArticle: [
    { t: 'path', tone: 'ink', d: 'M3 4h18v16H3z' },
    { t: 'rect', tone: 'accent', x: 6, y: 7, width: 5, height: 4 },
    { t: 'path', tone: 'ink', d: 'M13 8h5M13 11h5M6 14.5h12M6 17.5h8' },
  ],
  /** FAQ — Home FAQ block, help sections (group A: Public site) */
  faq: [
    { t: 'path', tone: 'ink', d: 'M4 5h16v11h-8l-4 4v-4H4z' },
    { t: 'path', tone: 'accent', d: 'M10 9.2a2 2 0 1 1 2 2.1v1' },
    { t: 'path', tone: 'accent', d: 'M12 14.8h.01' },
  ],
  /** Contact — Contact block, footer, support (group A: Public site) */
  contact: [
    { t: 'path', tone: 'ink', d: 'M4 13.5a8 8 0 0 1 16 0' },
    { t: 'rect', tone: 'ink', x: 2.5, y: 13, width: 4, height: 6 },
    { t: 'rect', tone: 'ink', x: 17.5, y: 13, width: 4, height: 6 },
    { t: 'path', tone: 'accent', d: 'M19.5 19.5a2.5 2.5 0 0 1-2.5 2.5h-3' },
  ],
  /** About Us — /about, footer company links (group A: Public site) */
  aboutUs: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M12 11v5.5' },
    { t: 'path', tone: 'accent', d: 'M12 7.8h.01' },
  ],
  /** Our Team — /about#team, team grid (group A: Public site) */
  ourTeam: [
    { t: 'circle', tone: 'ink', cx: 8.5, cy: 8.5, r: 2.8 },
    { t: 'circle', tone: 'accent', cx: 16.5, cy: 9, r: 2.4 },
    { t: 'path', tone: 'ink', d: 'M3 19.5c0-2.9 2.5-4.8 5.5-4.8s5.5 1.9 5.5 4.8' },
    { t: 'path', tone: 'accent', d: 'M15 14.9c3.1-.3 6 1.3 6 4.6' },
  ],
  /** Student Stories — /achievers, testimonials (group A: Public site) */
  studentStories: [
    { t: 'path', tone: 'ink', d: 'M4 4.5h16v11h-8l-4 4v-4H4z' },
    { t: 'path', tone: 'accent', d: 'M12 7.3l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z' },
  ],
  /** Newsletter — Signup block, unsubscribe page (group A: Public site) */
  newsletter: [
    { t: 'path', tone: 'ink', d: 'M3 6h18v12H3z' },
    { t: 'path', tone: 'ink', d: 'M3 7l9 6 9-6' },
    { t: 'path', tone: 'accent', d: 'M15 18l2.5 3L21 16' },
  ],
  /** Guides — How it works, GEO guide pages (group A: Public site) */
  guides: [
    { t: 'path', tone: 'ink', d: 'M4 4.5h5.5A2.5 2.5 0 0 1 12 7v12a2.2 2.2 0 0 0-2.2-2H4z' },
    { t: 'path', tone: 'accent', d: 'M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v12a2.2 2.2 0 0 1 2.2-2H20z' },
  ],
  /** Ranking — QS / THE badges, sort by rank (group B: Universities) */
  ranking: [
    { t: 'path', tone: 'ink', d: 'M3.5 20.5h17' },
    { t: 'rect', tone: 'ink', x: 4, y: 12, width: 4.5, height: 8.5 },
    { t: 'rect', tone: 'accent', x: 9.75, y: 6.5, width: 4.5, height: 14 },
    { t: 'rect', tone: 'ink', x: 15.5, y: 15, width: 4.5, height: 5.5 },
  ],
  /** Tuition Fee — Cost row, fee filter, program card (group B: Universities) */
  tuitionFee: [
    { t: 'path', tone: 'ink', d: 'M2.5 6h19v12h-19z' },
    { t: 'circle', tone: 'accent', cx: 12, cy: 12, r: 2.8 },
    { t: 'path', tone: 'ink', d: 'M6 12h.01M18 12h.01' },
  ],
  /** Location — Country / city meta, map block (group B: Universities) */
  location: [
    { t: 'path', tone: 'ink', d: 'M12 21s7-6.4 7-11.2A7 7 0 1 0 5 9.8C5 14.6 12 21 12 21z' },
    { t: 'circle', tone: 'accent', cx: 12, cy: 9.8, r: 2.6 },
  ],
  /** Programs — Course catalogue, program tabs (group B: Universities) */
  programs: [
    { t: 'path', tone: 'ink', d: 'M3 7.5h15v13H3z' },
    { t: 'path', tone: 'accent', d: 'M6.5 4h14.5v13' },
    { t: 'path', tone: 'ink', d: 'M6.5 12h8M6.5 16h5' },
  ],
  /** Requirements — Admission requirements section (group B: Universities) */
  requirements: [
    { t: 'path', tone: 'ink', d: 'M5 4.5h14v17H5z' },
    { t: 'path', tone: 'ink', d: 'M9 2.8h6v3.2H9z' },
    { t: 'path', tone: 'accent', d: 'M8.5 12.2l2.2 2.2 4.3-4.4' },
    { t: 'path', tone: 'ink', d: 'M8.5 17.5h7' },
  ],
  /** Acceptance Rate — Stat row, admission fit tiers (group B: Universities) */
  acceptanceRate: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M12 3.2A8.8 8.8 0 0 1 20.8 12' },
    { t: 'path', tone: 'ink', d: 'M9 15l6-6' },
    { t: 'circle', tone: 'ink', cx: 9.4, cy: 9.4, r: 0.9 },
    { t: 'circle', tone: 'ink', cx: 14.6, cy: 14.6, r: 0.9 },
  ],
  /** Intake Date — Start term, intake filter (group B: Universities) */
  intakeDate: [
    { t: 'path', tone: 'ink', d: 'M3 5.5h18v15.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 10.5h18M8 3v4.5M16 3v4.5' },
    { t: 'circle', tone: 'accent', cx: 12, cy: 15.5, r: 2.4 },
  ],
  /** Campus Photos — Gallery, image carousel (group B: Universities) */
  campusPhotos: [
    { t: 'path', tone: 'ink', d: 'M2.5 6.5h14v11h-14z' },
    { t: 'path', tone: 'accent', d: 'M7 20.5h14.5V9.5' },
    { t: 'circle', tone: 'ink', cx: 7, cy: 10.5, r: 1.4 },
    { t: 'path', tone: 'ink', d: 'M2.5 15.5l4-3.5 3.5 3 2.5-2.5 4 3.5' },
  ],
  /** Compare — Compare universities / programs (group B: Universities) */
  compare: [
    { t: 'path', tone: 'ink', d: 'M4 7h5.5M4 12h5.5M4 17h5.5' },
    { t: 'path', tone: 'accent', d: 'M14.5 7H20M14.5 12H20M14.5 17H20' },
    { t: 'path', tone: 'ink', d: 'M12 3.5v17' },
  ],
  /** Award Amount — Value row on scholarship card (group C: Scholarships) */
  awardAmount: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 9.5, r: 6 },
    { t: 'path', tone: 'ink', d: 'M8.5 14.8L6.5 21l5.5-3 5.5 3-2-6.2' },
    { t: 'path', tone: 'accent', d: 'M12 6.8v5.4M10.2 8.4h3.6' },
  ],
  /** Eligibility — Who can apply block (group C: Scholarships) */
  eligibility: [
    { t: 'circle', tone: 'ink', cx: 9.5, cy: 8, r: 3.2 },
    { t: 'path', tone: 'ink', d: 'M3.5 20c0-3.4 2.7-5.2 6-5.2' },
    { t: 'path', tone: 'accent', d: 'M13 17.6l2.3 2.3 4.7-4.8' },
  ],
  /** Deadline Alert — Closing soon badge, reminders (group C: Scholarships) */
  deadlineAlert: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 13.5, r: 7.5 },
    { t: 'path', tone: 'accent', d: 'M12 9.5v4l2.6 2' },
    { t: 'path', tone: 'ink', d: 'M6.2 4.2L4 6.4M17.8 4.2L20 6.4' },
  ],
  /** Funding Type — Full / partial / tuition-only tag (group C: Scholarships) */
  fundingType: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M12 12V3.2A8.8 8.8 0 0 1 20.8 12z' },
    { t: 'path', tone: 'ink', d: 'M12 12l-6.2 6.2' },
  ],
  /** Saved Scholarship — Saved list, shortlist toggle (group C: Scholarships) */
  savedScholarship: [
    { t: 'path', tone: 'ink', d: 'M3 9h18v11.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 9h18M12 9v11.5' },
    { t: 'path', tone: 'accent', d: 'M12 9c-1.2-3.4-6.3-3-6 0M12 9c1.2-3.4 6.3-3 6 0' },
  ],
  /** Mentor Profile — Directory card, profile header (group D: Advisors, mentors & achievers) */
  mentorProfile: [
    { t: 'path', tone: 'ink', d: 'M3 4.5h18v15H3z' },
    { t: 'circle', tone: 'ink', cx: 8.8, cy: 10, r: 2.4 },
    { t: 'path', tone: 'ink', d: 'M5.3 16c0-1.9 1.6-3 3.5-3s3.5 1.1 3.5 3' },
    { t: 'path', tone: 'accent', d: 'M15 9h4M15 12.5h4' },
  ],
  /** Book a Session — Booking CTA, slot picker (group D: Advisors, mentors & achievers) */
  bookSession: [
    { t: 'path', tone: 'ink', d: 'M3 5.5h18v15.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 10.5h18M8 3v4.5M16 3v4.5' },
    { t: 'path', tone: 'accent', d: 'M9 15.6l2.3 2.3 4.5-4.6' },
  ],
  /** Session Length — 30 / 60 min chips, checkout (group D: Advisors, mentors & achievers) */
  sessionLength: [
    { t: 'path', tone: 'ink', d: 'M6.5 3h11M6.5 21h11' },
    { t: 'path', tone: 'ink', d: 'M6.5 3c0 4.2 5.5 5.8 5.5 9s-5.5 4.8-5.5 9M17.5 3c0 4.2-5.5 5.8-5.5 9s5.5 4.8 5.5 9' },
    { t: 'path', tone: 'accent', d: 'M9.3 18h5.4' },
  ],
  /** Video Call — Meeting link, upcoming session (group D: Advisors, mentors & achievers) */
  videoCall: [
    { t: 'path', tone: 'ink', d: 'M3 6.5h12v11H3z' },
    { t: 'path', tone: 'accent', d: 'M15 10.2l6-3v9.6l-6-3z' },
  ],
  /** Rating & Review — Review list, rating badge (group D: Advisors, mentors & achievers) */
  ratingReview: [
    { t: 'path', tone: 'ink', d: 'M4 4.5h16v11h-8l-4 4v-4H4z' },
    { t: 'path', tone: 'accent', d: 'M12 7.3l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z' },
  ],
  /** Expertise Tag — Help topics, specialisation chips (group D: Advisors, mentors & achievers) */
  expertiseTag: [
    { t: 'path', tone: 'ink', d: 'M11 3.5H4v7l10 10 7-7z' },
    { t: 'circle', tone: 'accent', cx: 7.4, cy: 6.9, r: 1.5 },
  ],
  /** Become a Mentor — /mentors/apply, /achievers/apply (group D: Advisors, mentors & achievers) */
  becomeMentor: [
    { t: 'circle', tone: 'ink', cx: 9.5, cy: 8, r: 3.4 },
    { t: 'path', tone: 'ink', d: 'M3 20.5c0-3.7 2.9-5.7 6.5-5.7' },
    { t: 'path', tone: 'accent', d: 'M17 13.5v7M13.5 17h7' },
  ],
  /** Application Tracker — Stage rail on the apply workspace (group E: My Portal & Apply workspace) */
  applicationTracker: [
    { t: 'circle', tone: 'ink', cx: 5, cy: 12, r: 2.2 },
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 2.2 },
    { t: 'circle', tone: 'accent', cx: 19, cy: 12, r: 2.2 },
    { t: 'path', tone: 'ink', d: 'M7.2 12h2.6M14.2 12h2.6' },
  ],
  /** Checklist — Baseline checklist, task groups (group E: My Portal & Apply workspace) */
  checklist: [
    { t: 'path', tone: 'accent', d: 'M3.5 7.2l2 2 3.5-3.6M3.5 15.2l2 2 3.5-3.6' },
    { t: 'path', tone: 'ink', d: 'M12.5 7.5h8M12.5 16h8' },
  ],
  /** Countdown — Days-left pill on deadlines (group E: My Portal & Apply workspace) */
  countdown: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M12 6.2V12h5.4' },
  ],
  /** Submit Application — Confirm & submit step (group E: My Portal & Apply workspace) */
  submitApplication: [
    { t: 'path', tone: 'ink', d: 'M5 3h8l5 5v6.5H5z' },
    { t: 'path', tone: 'ink', d: 'M13 3v5h5' },
    { t: 'path', tone: 'accent', d: 'M3 18.5h12M11.5 15l3.5 3.5-3.5 3.5' },
  ],
  /** Document Upload — Dropzone, transcript upload (group E: My Portal & Apply workspace) */
  documentUpload: [
    { t: 'path', tone: 'ink', d: 'M6 3h7l5 5v13H6z' },
    { t: 'path', tone: 'ink', d: 'M13 3v5h5' },
    { t: 'path', tone: 'accent', d: 'M12 18.5v-6.5M9.4 14.6L12 12l2.6 2.6' },
  ],
  /** Auto-Parse — AI field extraction from a document (group E: My Portal & Apply workspace) */
  autoParse: [
    { t: 'path', tone: 'ink', d: 'M5.5 3h13v18h-13z' },
    { t: 'path', tone: 'ink', d: 'M9 7.5h6M9 11h6M9 14.5h3' },
    { t: 'path', tone: 'accent', d: 'M17.6 14.2l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z' },
  ],
  /** Application Status — Draft / submitted / offer flag (group E: My Portal & Apply workspace) */
  applicationStatus: [
    { t: 'path', tone: 'ink', d: 'M6 3v18' },
    { t: 'path', tone: 'accent', d: 'M6 4.2h12l-2.6 4 2.6 4H6z' },
  ],
  /** Multiple Courses — Selected courses, add another (group E: My Portal & Apply workspace) */
  multipleCourses: [
    { t: 'path', tone: 'ink', d: 'M3 8h13v12.5H3z' },
    { t: 'path', tone: 'accent', d: 'M6.5 4.5h13V17' },
    { t: 'path', tone: 'ink', d: 'M6 12.5h7M6 16h4.5' },
  ],
  /** Self Assessment — Reflection intake, questionnaires (group F: Strategy Master — extended) */
  selfAssessment: [
    { t: 'circle', tone: 'ink', cx: 9.5, cy: 7.8, r: 3.2 },
    { t: 'path', tone: 'ink', d: 'M3.5 19.5c0-3.4 2.7-5.2 6-5.2' },
    { t: 'circle', tone: 'accent', cx: 16.3, cy: 15.3, r: 3.5 },
    { t: 'path', tone: 'accent', d: 'M18.9 17.9l2.6 2.6' },
  ],
  /** Career Exploration — Career & direction module (group F: Strategy Master — extended) */
  careerExploration: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z' },
  ],
  /** Subject Exploration — Subject motivation, interests (group F: Strategy Master — extended) */
  subjectExploration: [
    { t: 'path', tone: 'ink', d: 'M9.5 3h5v5l4.4 9a2 2 0 0 1-1.8 3H7a2 2 0 0 1-1.8-3L9.5 8z' },
    { t: 'path', tone: 'accent', d: 'M7.6 15.5h8.8' },
  ],
  /** AI Insight — AI-generated analysis blocks (group F: Strategy Master — extended) */
  aiInsight: [
    { t: 'path', tone: 'ink', d: 'M7 7h10v10H7z' },
    { t: 'path', tone: 'accent', d: 'M10.8 10.8h2.4v2.4h-2.4z' },
    { t: 'path', tone: 'ink', d: 'M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4' },
  ],
  /** Action Step — Step-by-step plan items (group F: Strategy Master — extended) */
  actionStep: [
    { t: 'path', tone: 'ink', d: 'M3.5 20.5h4.2v-4.2h4.2v-4.2h4.2V7.9h4.4' },
    { t: 'circle', tone: 'accent', cx: 19.8, cy: 7.9, r: 2.2 },
  ],
  /** Micro-Step Focus — Micro-step guidance panel (group F: Strategy Master — extended) */
  microStepFocus: [
    { t: 'circle', tone: 'accent', cx: 12, cy: 12, r: 3.2 },
    { t: 'path', tone: 'ink', d: 'M12 3v4.2M12 16.8V21M3 12h4.2M16.8 12H21' },
  ],
  /** Progress Update — Dynamic progress, re-run report (group F: Strategy Master — extended) */
  progressUpdate: [
    { t: 'path', tone: 'accent', d: 'M20.5 9.5A8.5 8.5 0 1 0 19 18' },
    { t: 'path', tone: 'accent', d: 'M20.5 4.5v5h-5' },
    { t: 'path', tone: 'ink', d: 'M8 17v-3M12 17v-6M16 17v-4' },
  ],
  /** Final Check — Pre-submission verification (group F: Strategy Master — extended) */
  finalCheck: [
    { t: 'path', tone: 'ink', d: 'M12 3l8 3v6.2c0 4.8-3.4 7.9-8 8.8-4.6-.9-8-4-8-8.8V6z' },
    { t: 'path', tone: 'accent', d: 'M8.6 12.2l2.5 2.5 4.4-4.8' },
  ],
  /** Target Profile — Target profile / gap analysis (group F: Strategy Master — extended) */
  targetProfile: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'circle', tone: 'accent', cx: 12, cy: 12, r: 4.2 },
    { t: 'circle', tone: 'ink', cx: 12, cy: 10.7, r: 1.2 },
    { t: 'path', tone: 'ink', d: 'M10 14.6c.4-.9 1.1-1.3 2-1.3s1.6.4 2 1.3' },
  ],
  /** GlowBal Plus — Plus badge, upgrade CTA (group G: Plus & payment) */
  glowbalPlus: [
    { t: 'path', tone: 'accent', d: 'M12 2.8l2.7 5.6 6.1.9-4.4 4.2 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.3l6.1-.9z' },
    { t: 'path', tone: 'ink', d: 'M12 9.4v5.2M9.4 12h5.2' },
  ],
  /** Payment Method — Checkout, saved cards (group G: Plus & payment) */
  paymentMethod: [
    { t: 'path', tone: 'ink', d: 'M2.5 5h19v14h-19z' },
    { t: 'path', tone: 'ink', d: 'M2.5 10h19' },
    { t: 'path', tone: 'accent', d: 'M6 15h4.5' },
  ],
  /** Invoice — Receipt, billing history (group G: Plus & payment) */
  invoice: [
    { t: 'path', tone: 'ink', d: 'M6 2.8h12v18.4l-3-2-3 2-3-2-3 2z' },
    { t: 'path', tone: 'accent', d: 'M9.2 8.4h5.6' },
    { t: 'path', tone: 'ink', d: 'M9.2 12.4h5.6' },
  ],
  /** Promo Code — Plus promo redemption (group G: Plus & payment) */
  promoCode: [
    { t: 'path', tone: 'ink', d: 'M3 8h18v3.2a2.2 2.2 0 0 0 0 4.4V19H3v-3.4a2.2 2.2 0 0 0 0-4.4z' },
    { t: 'path', tone: 'accent', d: 'M9.2 15.2l5.6-6.4' },
    { t: 'circle', tone: 'accent', cx: 9.4, cy: 9.6, r: 1 },
    { t: 'circle', tone: 'accent', cx: 14.6, cy: 14.4, r: 1 },
  ],
  /** Subscription — Renewal date, plan status (group G: Plus & payment) */
  subscription: [
    { t: 'path', tone: 'ink', d: 'M3 5.5h18v15.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 10.5h18M8 3v4.5M16 3v4.5' },
    { t: 'path', tone: 'accent', d: 'M15.6 16.4a3.6 3.6 0 1 1-1.2-2.7' },
    { t: 'path', tone: 'accent', d: 'M15 12.6v2.4h-2.4' },
  ],
  /** User Management — /admin/users, roles (group H: Admin & coordinator) */
  userManagement: [
    { t: 'circle', tone: 'ink', cx: 9, cy: 7.8, r: 3.2 },
    { t: 'path', tone: 'ink', d: 'M3 19.5c0-3.3 2.7-5 6-5s6 1.7 6 5' },
    { t: 'circle', tone: 'accent', cx: 18, cy: 16, r: 2.8 },
    { t: 'path', tone: 'accent', d: 'M18 11.9v1.3M18 18.8v1.3M13.9 16h1.3M20.8 16h1.3' },
  ],
  /** Booking Management — /admin/bookings, session queue (group H: Admin & coordinator) */
  bookingManagement: [
    { t: 'path', tone: 'ink', d: 'M3 5.5h18v15.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 10.5h18M8 3v4.5M16 3v4.5' },
    { t: 'path', tone: 'accent', d: 'M7 14.5h10M7 17.8h6' },
  ],
  /** Content CMS — /admin/news, GEO CMS (group H: Admin & coordinator) */
  contentCms: [
    { t: 'path', tone: 'ink', d: 'M3 4.5h18v15H3z' },
    { t: 'path', tone: 'ink', d: 'M3 9h18M9 9v10.5' },
    { t: 'path', tone: 'accent', d: 'M13 16.6l4.2-4.2 1.9 1.9-4.2 4.2H13z' },
  ],
  /** Planner Ops — /admin/planner, template tuning (group H: Admin & coordinator) */
  plannerOps: [
    { t: 'path', tone: 'ink', d: 'M3.5 7h9M19 7h1.5M3.5 12h4.5M13 12h7.5M3.5 17h11M20 17h.5' },
    { t: 'circle', tone: 'accent', cx: 15, cy: 7, r: 2.2 },
    { t: 'circle', tone: 'accent', cx: 10.5, cy: 12, r: 2.2 },
    { t: 'circle', tone: 'accent', cx: 17.2, cy: 17, r: 2.2 },
  ],
  /** Analytics — Admin overview, funnel stats (group H: Admin & coordinator) */
  analytics: [
    { t: 'path', tone: 'ink', d: 'M3.5 20.5h17' },
    { t: 'path', tone: 'ink', d: 'M6.5 20.5v-6M11 20.5v-9M15.5 20.5v-4.5M20 20.5v-11' },
    { t: 'path', tone: 'accent', d: 'M5 10.5l5-5 5 3.5 5-5.5' },
  ],
  /** Empty State — No results, nothing saved yet (group I: System states) */
  emptyState: [
    { t: 'path', tone: 'ink', d: 'M3 8l3-4.5h12L21 8v12.5H3z' },
    { t: 'path', tone: 'ink', d: 'M3 8h18' },
    { t: 'path', tone: 'accent', d: 'M9.5 12.5h5' },
  ],
  /** Loading — Spinner, report generation (group I: System states) */
  loading: [
    { t: 'path', tone: 'accent', d: 'M12 3v4.5' },
    { t: 'path', tone: 'accent', d: 'M18.4 5.6l-3.2 3.2' },
    { t: 'path', tone: 'ink', d: 'M21 12h-4.5M18.4 18.4l-3.2-3.2M12 21v-4.5M5.6 18.4l3.2-3.2M3 12h4.5M5.6 5.6l3.2 3.2' },
  ],
  /** Error — Failed request, validation (group I: System states) */
  error: [
    { t: 'path', tone: 'ink', d: 'M12 3.8l9 16.7H3z' },
    { t: 'path', tone: 'accent', d: 'M12 10v4.4M12 17.5h.01' },
  ],
  /** Success — Saved, submitted, paid (group I: System states) */
  success: [
    { t: 'circle', tone: 'ink', cx: 12, cy: 12, r: 8.8 },
    { t: 'path', tone: 'accent', d: 'M7.8 12.4l2.9 2.9L16.4 9' },
  ],
  /** Notification — Bell with unread count (group I: System states) */
  notification: [
    { t: 'path', tone: 'ink', d: 'M6 16.5V11a6 6 0 0 1 11.4-2.6' },
    { t: 'path', tone: 'ink', d: 'M18 12.2v4.3l2 3H4l2-3' },
    { t: 'path', tone: 'ink', d: 'M10 19.5h4' },
    { t: 'circle', tone: 'accent', cx: 19, cy: 5.6, r: 2.6 },
  ],
  /** Locked — Plus-gated, sign-in required (group I: System states) */
  locked: [
    { t: 'path', tone: 'ink', d: 'M4.5 10h15v11h-15z' },
    { t: 'path', tone: 'ink', d: 'M8 10V7a4 4 0 0 1 8 0v3' },
    { t: 'path', tone: 'accent', d: 'M12 14v3.2' },
  ],
  /** Edit — Row action, inline edit (group J: Common actions) */
  edit: [
    { t: 'path', tone: 'ink', d: 'M4 20h4L20 8l-4-4L4 16z' },
    { t: 'path', tone: 'accent', d: 'M14.5 5.5l4 4' },
  ],
  /** Delete — Remove document, cancel item (group J: Common actions) */
  delete: [
    { t: 'path', tone: 'ink', d: 'M3.5 6.5h17' },
    { t: 'path', tone: 'ink', d: 'M6 6.5L7 21h10l1-14.5' },
    { t: 'path', tone: 'ink', d: 'M9 6.5V3.5h6v3' },
    { t: 'path', tone: 'accent', d: 'M10 11v6.5M14 11v6.5' },
  ],
  /** Upload — Generic upload button (group J: Common actions) */
  upload: [
    { t: 'path', tone: 'ink', d: 'M3.5 16v4.5h17V16' },
    { t: 'path', tone: 'accent', d: 'M12 16.5V3.8M7.2 8.6L12 3.8l4.8 4.8' },
  ],
  /** Download — Export PDF, save report (group J: Common actions) */
  download: [
    { t: 'path', tone: 'ink', d: 'M3.5 16v4.5h17V16' },
    { t: 'path', tone: 'accent', d: 'M12 3.8v12.7M7.2 11.7L12 16.5l4.8-4.8' },
  ],
  /** Filter — Directory filter panel (group J: Common actions) */
  filter: [
    { t: 'path', tone: 'ink', d: 'M3 4.5h18l-7 8.2v7.8l-4-2.4v-5.4z' },
    { t: 'path', tone: 'accent', d: 'M18.5 16.5h3.5' },
    { t: 'path', tone: 'accent', d: 'M20.2 14.8v3.4' },
  ],
  /** Sort — Sort select, table header (group J: Common actions) */
  sort: [
    { t: 'path', tone: 'ink', d: 'M3.5 6.5h11M3.5 12h8M3.5 17.5h5' },
    { t: 'path', tone: 'accent', d: 'M18.5 4.5v15M15.5 16.5l3 3 3-3' },
  ],
  /** Share — Share report, refer a friend (group J: Common actions) */
  share: [
    { t: 'circle', tone: 'ink', cx: 18, cy: 5.8, r: 2.8 },
    { t: 'circle', tone: 'ink', cx: 6, cy: 12, r: 2.8 },
    { t: 'circle', tone: 'accent', cx: 18, cy: 18.2, r: 2.8 },
    { t: 'path', tone: 'ink', d: 'M8.5 10.8l7-3.8M8.5 13.2l7 3.8' },
  ],
  /** Save — Bookmark toggle on any card (group J: Common actions) */
  save: [
    { t: 'path', tone: 'ink', d: 'M6 3h12v18l-6-5-6 5z' },
    { t: 'path', tone: 'accent', d: 'M9 16.5l3-2.5 3 2.5' },
  ],
  /** Copy Link — Official site link, share URL (group J: Common actions) */
  copyLink: [
    { t: 'path', tone: 'ink', d: 'M9.4 14.6l5.2-5.2' },
    { t: 'path', tone: 'accent', d: 'M13 7.2l2-2a3.7 3.7 0 0 1 5.3 5.3l-2 2' },
    { t: 'path', tone: 'ink', d: 'M11 16.8l-2 2a3.7 3.7 0 0 1-5.3-5.3l2-2' },
  ],
  /** More — Overflow menu on rows/cards (group J: Common actions) */
  more: [
    { t: 'circle', tone: 'ink', cx: 5, cy: 12, r: 1.7 },
    { t: 'circle', tone: 'accent', cx: 12, cy: 12, r: 1.7 },
    { t: 'circle', tone: 'ink', cx: 19, cy: 12, r: 1.7 },
  ],
} as const satisfies Record<string, readonly IconElement[]>;

export type GlowbalIconName = keyof typeof GLOWBAL_ICONS;
