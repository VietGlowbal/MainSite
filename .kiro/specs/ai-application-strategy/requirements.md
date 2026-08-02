# Requirements Document

## Introduction

Feature 2 — **AI Application Strategy** — is the AI-assisted workspace where a student prepares, assesses, improves and exports the two core documents of one university application: the **CV** and the **Personal Statement**. It implements step 4 of the five-stage Glowbal journey (`Reflection → Output Report → University Detail → Application Strategy → Submit Audit`), which is already declared in `src/features/apply/domain/ai-journey.ts` with `href: null`.

The student leaves the feature with a programme-specific CV strategy, confirmed structured CV content, evidence-backed CV feedback, a selected CV layout, an exported PDF, a programme-specific statement brief, a reviewed personal statement, a clear list of unresolved issues, and both documents ready for Submit Audit.

The strategy is expressed **only** through what each document must prove and how well the document proves it. The feature does not introduce candidate identity cards, strategic pillar selection, story-to-document mapping, a candidate persona, a university-matching system, admission-probability prediction, cross-document Submit Audit, or automatic recommendation-letter writing.

## Glossary

- **Strategy**: One `application_strategies` row scoping all Feature 2 work for a single `course_applications` row. One strategy per application.
- **applicationId**: `course_applications.id` (UUID). Ownership is `course_applications.user_id = auth.uid()`.
- **Target_Profile**: The seven-field statement of what the CV must demonstrate for the selected university and course (`cv_target_profiles`).
- **Structured_CV**: The ordered, sectioned, machine-editable CV content (`structured_cvs`), the single source of truth for assessment, layout preview and PDF export.
- **CV_Section**: One titled block of the Structured_CV (Education, Work experience, …) holding ordered CV_Entry records.
- **CV_Entry**: One item inside a CV_Section (an organisation/role/date/bullets record).
- **CV_Review**: One AI assessment of a Structured_CV against a Target_Profile (`cv_reviews`), producing three strengths and a list of missing signals.
- **Missing_Signal**: A claim the Target_Profile requires that the CV does not yet prove, with a reason, a recommended action and a target CV_Section.
- **Layout**: One of exactly three CV renders — `academic`, `technical`, `leadership` — each a genuinely different presentation of the same Structured_CV.
- **Statement_Brief**: The programme-specific explanation of what the personal statement must accomplish (`statement_strategies.brief`).
- **Statement_Analysis**: One AI analysis of a statement draft (`statement_analyses`) covering Overview, Ideas and Structure, Opening and Engagement, AACC and Readiness.
- **Feedback_Item**: One finding inside a Statement_Analysis, optionally bound to a passage of the draft by a verbatim quote.
- **AACC_Assessment**: A four-pillar assessment (Academic, Activities, Character, Contribution) of how clearly the *current draft* demonstrates each area. It is explicitly not an admission probability.
- **Content_Version**: A monotonically increasing integer on Structured_CV and on the statement, incremented on every meaningful content change. An analysis records the version it ran against; a mismatch makes the analysis **outdated**.
- **Status_Vocabulary**: Exactly four values — `not_started`, `in_progress`, `needs_attention`, `ready_for_audit`.
- **Strategy_Context**: The single server-side assembled AI context (`ApplicationStrategyContext`) that every Feature 2 AI operation consumes.
- **Glowbal_Chrome**: `TopNav` + `MobileNav` + `Container` + `Footer`, as assembled by `src/app/ai-strategy/reflection-chrome.tsx`. `/ai-strategy` is in both `OWN_CHROME_ROUTES` and `OWN_CHROME_PREFIXES` in `src/components/nav-reveal.tsx`, so every sub-route must ship its own chrome.
- **Suggestion_State**: The mandatory presentation of any AI rewrite — original text, suggested text, and Accept / Dismiss / Edit manually actions. AI never silently replaces student text.

## Design authority

Existing approved Glowbal designs are the primary visual source. Where a screenshot exists it must be reproduced faithfully in layout, hierarchy, spacing, typography, card treatment, button hierarchy, progress indicators, form structure, colour, borders and content density. An approved screen must not be redesigned because another pattern is easier to implement.

Where no design exists, new UI must be created and must be deeply inspired by current Glowbal designs: predominantly white canvas (`bg-surface`), generous whitespace, thin light-grey borders (`border-line`), minimal or no shadow, the rose brand accent (`bg-brand` / `text-fg-brand`), near-black headings (`text-fg`), muted grey supporting copy (`text-fg-tertiary`), compact top navigation, simple linear progress indicators (`ProgressBar`, `Stepper`), flat restrained cards, one obvious primary action, and limited information per view.

New UI must avoid dense analytics dashboards, sidebars, gradients, glassmorphism, large decorative illustrations, excessive iconography, competing primary buttons, admissions-probability displays, unexplained numerical scores, complex drag-and-drop, and gamification that does not improve the task.

> **Note on the brand accent.** The source specification describes a "coral-red/pink primary accent". The repository has no coral token; the brand is Rose 600 (`--color-gb-brand-600: #e11d48`) exposed as `bg-brand` / `text-fg-brand` / `border-brand`. Use the existing tokens. Do not add a coral token.

## Requirements

### Requirement 1: Entry, authorisation and routing

**User Story:** As a signed-in student, I want to open the Application Strategy workspace for an application I own, so that I can work on that application's documents.

#### Acceptance Criteria

1. THE feature SHALL expose these routes: `/ai-strategy/[applicationId]`, `/ai-strategy/[applicationId]/cv/target-profile`, `/ai-strategy/[applicationId]/cv/content`, `/ai-strategy/[applicationId]/cv/review`, `/ai-strategy/[applicationId]/cv/layout`, and `/ai-strategy/[applicationId]/statement`.
2. THE statement sections SHALL be selected by the `?section=` query parameter with the values `overview`, `ideas`, `opening`, `aacc`, `readiness`, AND THE feature SHALL NOT create separate routes for minor display states.
3. WHEN an unauthenticated visitor requests any Feature 2 page, THE page SHALL redirect to `/auth`.
4. WHEN a signed-in student requests a Feature 2 page for an `applicationId` whose `course_applications.user_id` is not their own, THE page SHALL render `notFound()` AND SHALL NOT disclose that the application exists.
5. WHEN an API endpoint receives a request without a session, THE endpoint SHALL return HTTP 401; WHEN the caller does not own the application, THE endpoint SHALL return HTTP 404.
6. THE addition of the `[applicationId]` dynamic segment SHALL NOT change the behaviour of the existing `/ai-strategy`, `/ai-strategy/reflection` and `/ai-strategy/reflection/achievements` routes.
7. EVERY Feature 2 page SHALL ship Glowbal_Chrome itself, because `/ai-strategy` is suppressed in `nav-reveal.tsx`.
8. WHEN recommended inputs (student profile, academic information, activities, achievements, selected university, selected course, parsed programme information, uploaded CV, existing statement) are missing, THE feature SHALL render an actionable incomplete state for the affected area AND SHALL NOT block the whole feature.
9. THE `AI_JOURNEY` entry for `strategy` SHALL be given a real `href` so the shared `Stepper` links to the workspace, AND the document-level progress indicators SHALL remain visually subordinate to the five-stage journey indicator.

### Requirement 2: Application Strategy overview

**User Story:** As a student, I want a simple entry point that tells me which application I am working on, what needs attention and what to do next.

#### Acceptance Criteria

1. THE overview SHALL render the five-stage journey indicator with Application Strategy highlighted.
2. THE overview SHALL display the application context: university logo when available, university name, course name, degree level when available, application deadline and application status.
3. WHEN a context value is missing, THE overview SHALL omit the value and its punctuation AND SHALL NOT render a placeholder.
4. THE overview SHALL render a CV workspace card showing overall CV status, last updated, Target_Profile status, content status, AI review status, selected layout and PDF export status.
5. THE overview SHALL render a statement workspace card showing overall statement status, word count, last saved, last analyzed, and the status of Ideas and Structure, Opening, AACC and Statement Readiness.
6. THE CV card's primary action SHALL be `Start CV strategy` when `not_started`, `Continue CV` when `in_progress`, `Review CV` when `needs_attention`, and `View or download CV` when `ready_for_audit`.
7. THE statement card's primary action SHALL be `Start statement` when `not_started`, `Continue writing` when `in_progress`, `Review feedback` when `needs_attention`, and `View statement` when `ready_for_audit`.
8. THE overview SHALL use only the Status_Vocabulary values, rendered as text plus an icon, AND SHALL NOT convey status by colour alone.
9. WHEN neither a CV nor a statement exists, THE overview SHALL display `Start with the document you already have, or create one from your Glowbal profile.` with `Start CV` and `Start statement` actions, of which exactly one is visually primary.
10. THE overview SHALL NOT render analytics-style charts, aggregate scores or an admissions probability.

### Requirement 3: CV Step 1 — Target Profile (existing design)

**User Story:** As a student, I want to see what my CV must demonstrate for this specific university and course.

#### Acceptance Criteria

1. THE page SHALL reproduce the approved "Xác định CV cần chứng minh những điều gì" design.
2. THE page SHALL render a four-step CV progress indicator — `Target Profile`, `Nội Dung`, `Bản CV`, `Layout and PDF` — with Target Profile highlighted.
3. THE page SHALL render seven fields labelled `Định hướng nghề nghiệp` (career direction, optional free text), `Định vị trường`, `Triết lý giáo dục`, `Môi trường`, `Mục tiêu chương trình`, `Năng lực ưu tiên` and `Career Alignment`.
4. WHEN no Target_Profile has been generated, THE fields SHALL be blank with quiet example text, THE page SHALL visually distinguish programme-derived from student-derived fields, AND THE examples SHALL NOT be presented as saved student information.
5. WHEN a Target_Profile has been generated, THE page SHALL preserve the exact approved layout and replace each blank example with editable generated content.
6. EACH generated card SHALL show the generated value, its data origin (`From university`, `From profile` or `Mixed`), an edit action, and a missing-information flag when relevant, AND SHALL NOT carry a large explanation panel.
7. THE primary generation action SHALL be labelled `Tạo trang target profile`.
8. THE generation response SHALL contain exactly the keys `careerDirection`, `universityPositioning`, `educationPhilosophy`, `environment`, `programmeObjectives`, `priorityCapabilities`, `careerAlignment`, `missingInformation` and `sourcesUsed`.
9. THE generator SHALL NOT invent candidate evidence or programme claims, SHALL use verified programme data where available, SHALL return empty or explicitly incomplete fields when evidence is insufficient, SHALL keep values concise, and SHALL store sources separately from field values.
10. EVERY generated value SHALL be editable by the student.
11. AFTER successful generation, THE primary action SHALL be `Tiếp tục nhập nội dung` and the secondary action SHALL be `Tạo lại target profile`, AND regeneration SHALL NOT be the dominant action.
12. THE page SHALL autosave edits and SHALL render a small restrained `Saving` / `Saved` / `Could not save` status near the page heading or the current field, AND SHALL NOT rely on a toast alone to confirm an autosave.
13. WHEN a Target_Profile field changes, THE `cv_target_profiles.version` SHALL increment so a later CV_Review can be detected as outdated.

### Requirement 4: CV Step 2 — Nội Dung (new design)

**User Story:** As a student, I want to create and edit the structured CV content that my assessment, layout preview and PDF are built from.

#### Acceptance Criteria

1. THE page SHALL be created in the existing Glowbal style, using the Target Profile, AI Assessment and Layout screens as style references, and SHALL read as a document rather than a dashboard.
2. THE page SHALL render Glowbal_Chrome, the four-step CV progress indicator, the heading `Nội dung CV`, a short explanation, CV source/import controls, the structured section editor, and a persistent primary continuation action.
3. THE page SHALL offer three content sources — import an uploaded CV, build from the Glowbal profile, start manually — AND WHEN an uploaded CV already exists THE import option SHALL be surfaced as the recommended first option.
4. THE editor SHALL support the sections Contact information, Education, Work experience, Activities and leadership, Projects, Research, Awards, Skills, Certifications, Publications and Interests.
5. THE student SHALL be able to add sections, remove optional sections, reorder sections, rename only appropriate custom sections, reorder entries, and edit all extracted content.
6. EACH entry SHALL support organisation, role or title, location, start date, end date, a current-status checkbox, description bullets, evidence or metrics, and a linked Glowbal profile item, AND SHALL show only the fields relevant to its section type.
7. EACH section SHALL render as a simple bordered card with a section heading, a reorder control, an add-entry action, a collapse/expand action, and a remove action for optional sections.
8. EACH entry SHALL remain compact when collapsed, AND THE page SHALL NOT display every field of every entry simultaneously.
9. EACH entry SHALL offer the AI actions `Make this clearer`, `Make this more concise`, `Highlight impact`, `Add confirmed evidence from my profile` and `Tailor to this course`.
10. EVERY AI output SHALL be presented in Suggestion_State — original text, suggested text, Accept, Dismiss, Edit manually — AND SHALL NEVER silently replace student content.
11. THE primary continuation action SHALL be `Review my CV`, THE student SHALL be able to continue with incomplete sections, AND a small warning SHALL be shown when essential information is missing.
12. WHEN Structured_CV content changes, THE `structured_cvs.content_version` SHALL increment.

### Requirement 5: CV import and extraction confirmation (new design)

**User Story:** As a student, I want to confirm what Glowbal extracted from my CV before it becomes my structured content.

#### Acceptance Criteria

1. THE flow SHALL be: upload or select an existing CV → parsing state → extracted sections presented → student confirms or corrects → confirmed structured content saved → continue to CV Content.
2. THE parsing states SHALL be `Uploading`, `Reading document`, `Organizing content`, `Ready to review` and `Could not read document`, AND SHALL NOT display a fabricated percentage in the absence of real byte-level progress.
3. THE confirmation screen SHALL present extracted sections in the same section-card treatment as the Content editor.
4. THE confirmation screen SHALL mark uncertain fields with `Please check` AND SHALL offer `Confirm all`, `Review individually`, `Start with this content` and `Cancel import`.
5. WHEN text extraction returns no text — including DOCX, scanned PDFs and image-only documents — THE flow SHALL display `We saved your file, but we could not read its text.` and offer `Paste CV text`, `Enter information manually`, `Upload a text-based PDF` and `Try another file`.
6. THE flow SHALL NOT leave the student at a generic error.
7. THE import SHALL NOT overwrite existing Structured_CV content without explicit confirmation.

### Requirement 6: CV Step 3 — AI Assessment (existing design)

**User Story:** As a student, I want evidence-backed feedback on whether my CV proves what my Target Profile says it must.

#### Acceptance Criteria

1. THE page SHALL reproduce the approved "AI ASSESSMENT" design, reusing the four-step progress indicator, the AI Assessment panel, three strengths, missing signals, the CV preview, the CV review action and the layout action, with `Bản CV` highlighted.
2. EACH strength SHALL contain a short title, supporting CV evidence, the relevant Target_Profile area and its programme relevance, AND THE visible list SHALL stay concise with detailed evidence revealed on expansion.
3. EACH Missing_Signal SHALL contain the missing or weak claim, why it matters, a recommended action and the relevant CV section.
4. EACH Missing_Signal SHALL offer `Open relevant section`, which navigates or scrolls to the correct Content section.
5. THE analysis response SHALL contain the keys `strengths` (with `title`, `evidence`, `targetProfileArea`, `programmeRelevance`, `strength`), `missingSignals` (with `signal`, `reason`, `action`, `targetSection`), `summary` and `sourcesUsed`.
6. THE page SHALL implement the states `Not analyzed`, `Analyzing`, `Analysis complete`, `Analysis outdated`, `Analysis failed`, `Missing CV content` and `Critical gaps resolved`.
7. WHEN the Target_Profile version or the Structured_CV content version has changed since the stored CV_Review, THE page SHALL display `Your CV has changed since this review. Run the review again to refresh the feedback.` with the actions `Re-run review` and `Continue to layout anyway`, AND SHALL NOT hard-block layout selection.
8. WHEN analysis fails, THE page SHALL show a clear error with `Retry` and `Continue editing` AND SHALL NOT display a raw provider message.
9. THE assessment SHALL reference actual Structured_CV content and actual Target_Profile requirements, AND SHALL NOT invent evidence.

### Requirement 7: CV Step 4 — Layout and PDF (existing page structure)

**User Story:** As a student, I want to choose how my CV is presented and export a clean PDF.

#### Acceptance Criteria

1. THE page SHALL reproduce the approved "Layout - PDF" page structure.
2. THE feature SHALL implement three genuinely different renders of the same Structured_CV: `academic` emphasising education, research, publications, academic projects and awards; `technical` emphasising skills, technical projects, engineering or software work and measurable technical outcomes; `leadership` emphasising roles, organisations, activities, community impact and management responsibility. Differences SHALL be structural, not label-only.
3. EACH layout card SHALL implement the states `Default`, `Hover`, `Keyboard focus`, `Selected`, `AI recommended`, `Selected and recommended` and `Selected but not recommended`.
4. SELECTION SHALL be conveyed by border, icon or check, and text label together, AND SHALL NOT be conveyed by colour alone.
5. THE AI recommendation SHALL be explained in one short sentence built from actual strategy information, in the manner of `Technical is recommended because your Target Profile prioritizes analytical and technical capability, and your strongest evidence appears in projects and technical experience.`
6. THE preview SHALL render real CV content with multi-page support, page navigation, zoom controls where needed, stable pagination, no overflow, no clipped text, selectable PDF text, ATS-readable ordering and accessible contrast.
7. THE page SHALL implement the export states `Ready to export`, `Generating PDF`, `PDF ready`, `Export failed`, `Export outdated` and `Multi-page preview`.
8. THE page SHALL offer `Download PDF`, `Print CV`, `Retry export`, `Return to Content` and `Re-run review`.
9. WHEN the Structured_CV content version has changed since the last export, THE export SHALL be marked outdated.
10. THE selected layout SHALL persist on `structured_cvs.selected_layout`.

### Requirement 8: Personal Statement Strategy Brief (new design)

**User Story:** As a student, I want to know what my statement needs to accomplish before and while I write it.

#### Acceptance Criteria

1. THE brief SHALL be a collapsible panel integrated into the existing statement screen, not a separate dashboard.
2. THE brief SHALL contain university, course, essay prompt, word limit, what the statement should demonstrate, relevant programme information, candidate evidence to consider, what the CV already covers, and missing information.
3. THE brief SHALL default to a compact summary with an expand action, AND when expanded SHALL render simple grouped rows with source links only where relevant and no analytics.
4. WHEN the statement is empty, THE brief SHALL offer the primary action `Start with this brief`.
5. THE brief MAY recommend evidence or a story to use, AND SHALL NOT generate personal experiences.

### Requirement 9: Statement editor (existing design)

**User Story:** As a student, I want to write and revise my statement with my progress and feedback close at hand.

#### Acceptance Criteria

1. THE page SHALL reproduce the structure of the approved "Strengthen Your Statement" design, containing the five-stage journey indicator, the page heading, the Statement Strategy Brief, the `Personal Statement` label, the editor, a word count, an edit action, a re-analyze action, an AI Feedback action, the analysis-section navigation, and the detailed feedback below.
2. THE editor SHALL autosave, preserve formatting, display the word count, display the word limit when known, and warn before a destructive replacement.
3. WHEN the statement content changes, THE content version SHALL increment AND any previous Statement_Analysis SHALL be marked outdated.
4. WHEN the statement is empty, THE page SHALL display the Strategy Brief, a large editor, a `Paste statement` action, a `Start writing` action and an optional upload/import, with the analysis action disabled until meaningful content exists.
5. THE page SHALL reuse the existing statement components (`StatementWriter`, `StatementFeedbackModal`) and the existing `personal_statements` storage rather than introducing a competing editor.

### Requirement 10: Statement inline feedback (new design)

**User Story:** As a student, I want each piece of feedback attached to the exact passage that caused it.

#### Acceptance Criteria

1. THE feature SHALL implement the states `Passage highlighted`, `Feedback item active`, `Feedback item resolved`, `Suggestion accepted`, `Suggestion dismissed`, `Manual edit`, `Suggested revision preview` and `No reliable text range`.
2. EACH Feedback_Item SHALL display its category, an explanation, the relevant quote, a suggested action and an optional suggested revision.
3. EACH Feedback_Item SHALL offer `Accept`, `Dismiss` and `Edit manually`.
4. THE feature SHALL NOT replace the full statement without explicit confirmation.
5. WHEN stored character offsets no longer match the draft, THE feature SHALL attempt to re-match by verbatim quote; WHEN re-matching fails, THE feature SHALL display the feedback without a highlight AND SHALL NOT attach it to the wrong text.

### Requirement 11: Statement analysis sections

**User Story:** As a student, I want my statement assessed from several angles so I know what to fix first.

#### Acceptance Criteria

1. THE analysis navigation SHALL use the existing horizontal progress treatment and SHALL contain `Overview`, `Ý tưởng và Cấu trúc`, `Mở bài và sức hút`, `Đánh giá AACC` and `Submit Audit / Readiness`.
2. THE Overview section SHALL report what the essay currently communicates, the strongest quality, the most important issue, and whether it answers the prompt, in a few clear cards or rows.
3. THE Ideas and Structure section SHALL reproduce its approved design and SHALL assess central idea, story selection, logical progression, evidence, reflection, programme connection, prompt coverage and repetition.
4. THE Opening and Engagement section SHALL assess clarity, specificity, authenticity, reader orientation, relevance and unnecessary gimmicks, using the same finding-list treatment as Ideas and Structure.
5. THE AACC section SHALL display four pillars — Academic, Activities, Character, Contribution — each with a score, an explanation, evidence from the statement, missing evidence and a recommended improvement.
6. THE AACC section SHALL state `This score measures how clearly the current draft demonstrates this area. It is not an admission probability.`, SHALL render scores visually secondary to explanation and evidence, AND SHALL NOT display an overall admissions score.
7. THE Statement Readiness section SHALL check prompt answered, word limit, placeholder text, incomplete sentences, unsupported claims, profile contradictions, repeated sections, missing programme references and unresolved critical feedback, and SHALL resolve to `Needs attention` or `Ready for Submit Audit`.
8. THE Readiness check SHALL be a statement-level check only and SHALL NOT present itself as the full Submit Audit.
9. THE generalised AACC implementation SHALL NOT alter the behaviour of the existing VinUni-specific endpoint `/api/ai/analyze-statement-aacc`, which scores a different four pillars (Ability, Aspirations, Creativity, Commitment).

### Requirement 12: Completion and Submit Audit handoff (new design)

**User Story:** As a student, I want to know when both documents are ready and where to go next.

#### Acceptance Criteria

1. WHEN both documents are ready, THE overview SHALL show CV ready, PDF generated, statement ready, remaining non-blocking suggestions and last-updated dates, with the primary action `Continue to Submit Audit`.
2. WHEN only one document is ready, THE primary action SHALL take the student to the highest-priority unfinished item.
3. WHEN the profile, programme, Target_Profile or document content changes materially, THE affected analyses SHALL be marked outdated AND THE student SHALL be told which review to refresh.
4. THE feature SHALL NOT silently mark a document incomplete without an explanation.

### Requirement 13: Shared system states

**User Story:** As a student, I want every failure or empty screen to tell me what to do next.

#### Acceptance Criteria

1. THE feature SHALL implement `Saving`, `Saved`, `Could not save`, `Loading page`, `No parsed programme data`, `No CV uploaded`, `Unsupported CV`, `Unreadable CV`, `CV parsing`, `CV analysis not started`, `CV analyzing`, `CV analysis outdated`, `CV analysis failed`, `Empty statement`, `Statement analyzing`, `Statement analysis outdated`, `AI provider unavailable`, `Export generating`, `Export failed`, `Unauthorized application` and `Application not found`.
2. EACH state SHALL provide exactly one useful recovery action.
3. EACH state SHALL be built from the existing Glowbal empty-state, alert, card and button styles.

### Requirement 14: Mobile

**User Story:** As a student on a phone, I want the whole workflow to work without hover.

#### Acceptance Criteria

1. NO interaction SHALL depend on hover.
2. THE overview SHALL stack the workspace cards, keep status and next action visible, and avoid dense sub-status grids.
3. THE CV Content editor SHALL collapse entries, use full-width fields, provide touch-friendly reorder controls, and avoid horizontally scrolling forms.
4. THE CV Assessment SHALL stack strengths and missing signals, place the CV preview below the feedback, and use full-width actions.
5. THE statement editor SHALL stack the editor and the feedback, keep the active feedback near its highlighted passage where possible, and make the analysis navigation horizontally scrollable or compact.
6. THE layout selection SHALL stack the template cards, show one preview at a time, and keep selected and recommended states unambiguous.

### Requirement 15: Data model and row-level security

**User Story:** As a platform owner, I want Feature 2 data owned by exactly one student and unreachable by anyone else.

#### Acceptance Criteria

1. THE schema SHALL define `ApplicationStrategy`, `CvTargetProfile`, `StructuredCv`, `CvReview`, `StatementStrategy` and `StatementAnalysis` with the fields given in the source specification.
2. EVERY new table SHALL have row-level security enabled with an owner policy keyed on `auth.uid()`, following the `<table>_owner` `FOR ALL` convention in `supabase-reflection.sql`.
3. THE migration SHALL be idempotent (`IF NOT EXISTS`, `pg_policies` guard) and SHALL follow the flat root-level `supabase-<topic>.sql` naming convention used by this repository.
4. THE strategy row SHALL be unique per application.
5. `StatementAnalysis` and `CvReview` SHALL record the content and strategy versions they ran against.

### Requirement 16: API surface

**User Story:** As a developer, I want every Feature 2 endpoint to behave consistently.

#### Acceptance Criteria

1. THE feature SHALL expose `GET`/`POST /api/applications/[id]/strategy`; `GET`/`PATCH /api/applications/[id]/cv/target-profile` and `POST .../generate`; `GET`/`PATCH /api/applications/[id]/cv`; `POST /api/applications/[id]/cv/import`; `POST /api/applications/[id]/cv/review`; `POST /api/applications/[id]/cv/export`; `GET`/`PATCH /api/applications/[id]/statement`; `POST /api/applications/[id]/statement/brief`; `POST /api/applications/[id]/statement/analyze`.
2. EVERY endpoint SHALL authenticate the caller, verify application ownership, validate its input with zod, and return a stable response shape.
3. EVERY AI endpoint SHALL be rate-limited using the existing `src/lib/rate-limiter` middleware, SHALL support an idempotency key for repeatable generation, and SHALL hide raw provider errors behind a student-readable message.
4. NO endpoint SHALL return personal information unrelated to the requested resource.
5. EVERY AI endpoint SHALL declare `runtime = 'nodejs'` and a `maxDuration` sufficient for the model call.
6. EVERY dynamic route handler SHALL read `params` as a promise, per Next.js 16.

### Requirement 17: Shared AI context

**User Story:** As a developer, I want one place that assembles what the model is allowed to know.

#### Acceptance Criteria

1. THE feature SHALL provide one server-side assembler returning `ApplicationStrategyContext` with `candidate` (academics, achievements, activities, goals, preferences), `application` (universityName, courseName, requirements, courseSummary, deadline, sources) and `documents` (cvText, structuredCv, statementText).
2. EVERY Feature 2 AI operation SHALL consume this assembler and SHALL NOT read candidate or programme data directly.
3. THE assembler SHALL reuse the existing `extractDocumentText` path and cache extracted text back to `uploaded_documents.parsed_text`, as `/api/applications/[id]/match-insights` already does.
4. WHEN a document was uploaded but its text could not be extracted, THE assembler SHALL record that fact so the model does not claim the document is absent.

### Requirement 18: Trust rules

**User Story:** As a student, I want to trust that the AI is not making things up about me.

#### Acceptance Criteria

1. THE AI SHALL use only confirmed student information.
2. THE AI SHALL cite relevant programme sources.
3. THE AI SHALL distinguish fact from interpretation.
4. THE AI SHALL leave a field incomplete rather than invent content.
5. THE AI SHALL preserve student-approved text and SHALL present revisions as suggestions that can be dismissed or edited.
6. THE AI SHALL NOT guarantee admission, SHALL NOT present any score as an admission probability, and SHALL NOT invent metrics, roles, skills, impact or experiences.

### Requirement 19: Analytics

**User Story:** As a product owner, I want to know how the workflow is used without collecting document content.

#### Acceptance Criteria

1. THE feature SHALL emit the events `strategy_opened`, `cv_target_profile_generated`, `cv_target_profile_edited`, `cv_import_started`, `cv_import_completed`, `cv_import_failed`, `cv_review_started`, `cv_review_completed`, `cv_review_failed`, `cv_layout_selected`, `cv_export_started`, `cv_export_completed`, `cv_export_failed`, `statement_brief_generated`, `statement_analysis_started`, `statement_analysis_completed`, `statement_analysis_failed`, `statement_feedback_accepted`, `statement_feedback_dismissed` and `strategy_ready_for_audit`.
2. NO event payload SHALL include document content.
3. THE events SHALL be recorded through the existing `application_events` model rather than a new bespoke store.

### Requirement 20: Reuse

**User Story:** As a maintainer, I want Feature 2 built from the primitives that already exist.

#### Acceptance Criteria

1. THE feature SHALL reuse `TopNav`, `MobileNav`, `Stepper`, `ProgressBar`, `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `FormField`, `Badge`, `Modal`, `FileDropzone`, `DocumentRow`, `Container`, `Section`, `RepeatableFieldset`, `EmptyState`, `Card`, `KitIcon`, the route-loading pattern, the Supabase server/client/admin factories, `useDocumentUpload`, `extractDocumentText`, `StatementWriter`, `StatementFeedbackModal`, the course-parser source data, the application ownership query, and the design tokens.
2. THE feature SHALL NOT create a competing version of any existing primitive.
3. WHERE a needed primitive genuinely does not exist, THE feature SHALL add it to the shared layer once rather than inline it per screen.

### Requirement 21: Verification

**User Story:** As a maintainer, I want the risky paths covered by tests.

#### Acceptance Criteria

1. THE test suite SHALL cover the success path, incomplete input data, stale/outdated results, unreadable files, AI failure, export failure and ownership rejection.
2. THE suite SHALL run under the existing Vitest `node` and `dom` projects, with tests placed to match the existing include globs.
3. THE feature SHALL NOT lower the coverage thresholds in `vitest.config.ts`.
4. `npm run typecheck`, `npm run typecheck:strict`, `npm run lint` and `npm test` SHALL pass.

## Open decisions

These need an answer before the phase that depends on them. Each has a stated default so implementation is not blocked.

1. **Paywall.** `AI_JOURNEY` marks `strategy` as `paid: true`, and `Stepper` renders locked steps as a wall. **Default:** reading, editing and autosaving are free; the five AI endpoints (`target-profile/generate`, `cv/review`, `statement/brief`, `statement/analyze`, and per-entry CV suggestions) require `student_profiles.plus_status`, matching the gating already used by `/api/applications/[id]/match-insights`. Non-Plus students see `UpgradePromptModal`. — *Blocks Phase 1.*
2. **PDF generation.** The repository can read PDFs (`unpdf`) but cannot write them. **Default:** add `@react-pdf/renderer` (pinned) and render server-side into Supabase Storage, which satisfies selectable text, ATS ordering, stable pagination and multi-page. Rejected alternatives: `window.print()` (no stored artifact, no export states, no pagination control) and headless Chromium (not viable on the current serverless target). — *Blocks Phase 5.*
3. **AACC pillar names.** This specification names the pillars Academic / Activities / Character / Contribution. The existing VinUni endpoint scores Ability / Aspirations / Creativity / Commitment. **Default:** implement this specification's four pillars in the new generalised analyzer and leave the VinUni endpoint untouched. — *Blocks Phase 6.*
4. **Language.** The `/ai-strategy/reflection` pages hardcode Vietnamese rather than calling `t()`. **Default:** follow that precedent for the labels this specification fixes in Vietnamese, and add the corresponding entries to `src/lib/i18n-dictionary.ts` for strings that also appear in English. — *Blocks Phase 2.*
