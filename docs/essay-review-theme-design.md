# Essay Review Theme Design

Date: 2026-07-29

Status: **Implemented and regression-tested**

Reconciled: 2026-08-06 at `de4a7fe`

Implementation lives in `src/components/statement/StatementFeedbackWorkspace.tsx`
and `StatementWriter.tsx`; generic and VinUni theme assertions pass in
`StatementWriter.test.tsx`. The earlier warning about unrelated uncommitted LOR
work is historical—the LOR workflow is now committed and implemented.

## Understanding

- Restyle the generic and VinUni essay-review experiences using the supplied theme.
- Preserve analysis, persistence, API, and feedback behavior.
- Keep LOR presentation and in-progress LOR changes out of scope.
- Support desktop and mobile without new dependencies.

## Assumptions

- Existing design tokens and installed fonts remain the source of truth.
- Current security, reliability, and scale characteristics do not change because this is presentation-only.
- Existing tests plus a production build are sufficient validation.

## Final design

- Use a `#FAFAFA` workspace with a 1280px maximum content width.
- Use Bricolage Grotesque for display headings and the existing body font.
- Present editor and feedback as white, neutral-bordered, 16px-radius cards separated by 40px on desktop.
- Use rose `#E11D48` for the primary action, badges, focus, and active states.
- Keep the existing mobile pane navigation and make both panes fill the available width.
- Give the empty feedback state a centered rose icon and concise guidance.
- Preserve existing loading, error, disabled, keyboard, and result states.

## Decision log

- Chosen: one shared themed frame in `StatementWriter` for generic and VinUni review.
- Rejected: color-only reskin because it would not reproduce the supplied composition.
- Rejected: separate generic and VinUni components because it duplicates layout and increases maintenance.
- No dependency, API, schema, or data-flow changes.

## Risk

The shared components now serve generic Essay Review, VinUni review, and LOR.
Future visual changes must keep mode-specific routing and LOR stage behavior
intact; use the existing component tests rather than treating the files as a
presentation-only surface.
