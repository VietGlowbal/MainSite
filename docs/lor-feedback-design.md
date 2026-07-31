# LOR Feedback Design

Date: 2026-07-31

## Understanding summary

- Add a dedicated `/apply/[applicationId]/lor-feedback` page.
- The user pastes an existing Letter of Recommendation draft; file upload and letter generation are out of scope.
- Recommendation-related application tasks open the new page.
- Reuse Essay Review's editor, score, summary, inline suggestions, checklist, loading states, quota, and autosave behavior.
- Evaluate with an LOR-specific rubric and application context already stored in Supabase.
- Do not use the student's CV/profile or browse external websites.
- Persist the latest LOR draft and feedback so the user can continue later.

## Assumptions

- Only the authenticated owner of an application may read, review, or update its LOR draft.
- Missing programme context does not block a general LOR review; the UI explains that fit feedback is limited.
- Each review uses one AI request and follows the existing Essay Review free/Plus policy.
- One latest LOR draft is stored per application.
- The feature gives writing feedback; it does not verify the recommender's identity or submit the letter.
- Existing Essay Review behavior must remain backward compatible.

## Final design

### Architecture

Add a server page that authenticates the user and loads `ApplicationWorkspaceView` in the same way as Statement Feedback. Extend the existing statement workspace/writer with a minimal `reviewType: 'statement' | 'lor'` configuration whose default is `statement`.

In LOR mode the shared writer:

- uses LOR labels, instructions, and placeholder text;
- hides the Personal Statement/SOP selector;
- retains the existing editor and feedback presentation;
- reads and writes only drafts whose `doc_type` is `recommendation_letter`.

Extend `/api/ai/analyze-statement` with an LOR branch. The server receives `applicationId`, verifies ownership, and derives trusted context from `course_applications`, `courses`, `application_requirements`, and `application_sources`. Client-supplied university/programme names are not trusted for LOR evaluation.

Add `isLorTask()` to recognize recommendation-letter/reference/referee/recommender tasks and route them to the dedicated page. Extend the `personal_statements.doc_type` constraint through an idempotent migration rather than adding another draft table.

### Data flow

1. The user opens a recommendation-related task and pastes the LOR draft.
2. The client submits `text`, `applicationId`, and `docType: 'recommendation_letter'`.
3. The server authenticates the user, verifies application ownership, and loads bounded programme context from Supabase.
4. The AI returns the existing `AIAnalysis` shape: `score`, `summary`, `suggestions`, and `checklist`.
5. The shared UI renders the result and autosaves the draft plus analysis.

Inputs are limited to approximately 80-15,000 characters. A superseded request is aborted when the user starts another review.

### LOR rubric

- Clear recommender relationship and point of view.
- Specific, credible evidence of the applicant's qualities and impact.
- Relevance to the target university and programme.
- Authentic, professional recommender voice.
- Avoidance of generic praise, unsupported claims, and CV repetition.
- Persuasive structure and conclusion.

The AI must not invent achievements, roles, or relationships. When facts are missing, it should request evidence or use a placeholder instead of fabricating content.

### Errors and edge cases

- `401` for unauthenticated requests.
- `404` for missing applications and applications owned by another user.
- `400` for invalid or out-of-range text.
- `402` when the existing review allowance is exhausted.
- `502` when the AI response is absent or invalid.
- Missing programme context falls back to a general review with a limited-fit notice.
- Autosave failure keeps the editor content intact and exposes a retryable unsaved state.

### Verification

- Unit-test LOR task recognition, including negative cases.
- Verify LOR, Essay, and CV tasks route to their respective pages.
- Verify draft queries isolate `recommendation_letter` from existing statement types.
- Test authentication, ownership, input bounds, quota, and invalid AI responses.
- Assert LOR prompts contain Supabase programme context and exclude CV/profile context.
- Test saving and restoring LOR drafts and analyses.
- Run the existing Essay Review tests to catch regressions.

## Decision log

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Dedicated LOR page with shared writer | Selector inside Essay Review | Clear entry point without duplicating the editor |
| Extend the current draft table with `recommendation_letter` | New LOR table | Smallest schema and persistence change |
| Extend the current analysis endpoint with an LOR branch | Separate LOR endpoint; generic document framework | Reuses existing auth, quota, model call, and response shape |
| Use only stored application/course data | CV/profile context; live web retrieval | Matches the requested scope and keeps review deterministic |
| Preserve the current `AIAnalysis` response | New LOR response schema | Reuses the complete feedback UI |
| No generic document-review framework | Refactor Essay and LOR into a new abstraction | Avoids speculative architecture before more document types exist |
