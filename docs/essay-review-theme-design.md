# Essay Review Theme Design

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

`StatementFeedbackWorkspace.tsx` and `StatementWriter.tsx` contain unrelated uncommitted LOR work. Implementation must preserve it and limit edits to shared essay-review layout and styles.
