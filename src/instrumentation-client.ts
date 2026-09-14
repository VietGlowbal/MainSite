/**
 * Client code that runs before the app's own (Next's instrumentation-client
 * hook). Keep it synchronous: only top-level synchronous work is guaranteed to
 * finish before hydration.
 *
 * ZOD `jitless`. Zod 4 compiles object parsers with `new Function`, and decides
 * whether it may by probing `Function("")` when each object schema is created.
 * The enforced CSP has no `'unsafe-eval'` (src/shared/lib/content-security-policy.ts),
 * so that probe is refused. Harmless — Zod catches it and parses without the
 * compiled fast path — but the browser logs a CSP violation on every page that
 * builds a schema (the chunk is on 40 routes, measured 2026-09-14). With
 * `jitless` set, `fastEnabled = jit && allowsEval.value` short-circuits and the
 * probe never runs. It must be set before any module calling `z.object(...)`
 * at the top level is evaluated, which is why it lives here.
 */
import { config } from 'zod/v4/core';

config({ jitless: true });
