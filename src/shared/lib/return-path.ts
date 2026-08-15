/**
 * Is `path` safe to `router.push`/redirect to as a same-origin, internal
 * "return to where I came from" destination?
 *
 * Every producer of a `return`/`returnTo` query value in this codebase is
 * first-party code building the string itself (see the note in
 * `docs/current-status.md` on the existing `?return=` family) — but the
 * value still arrives at the consuming page as an ordinary, attacker-
 * controllable query parameter, and a profile editor now `router.push`es it
 * directly. That makes it worth a real guard rather than trusting
 * `encodeURIComponent` alone: this rejects anything that is not a plain,
 * same-origin relative path, so a crafted `return=` value can never send a
 * student to an external host.
 *
 * Deliberately conservative rather than exhaustive — it does not need to
 * recognise every legitimate internal path, only to refuse everything that
 * is not obviously one:
 *  - must start with a single `/` (a relative path)
 *  - must not start with `//` or `/\` (protocol-relative — browsers treat
 *    `//evil.com` as `https://evil.com`)
 *  - must not contain a `:` before the first `/`, `?`, or `#` (rules out
 *    `javascript:`, `data:`, or an absolute `scheme://host` slipped in
 *    without a leading slash)
 */
export function isAllowedInternalReturnPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//') || path.startsWith('/\\')) return false;

  const delimiterIndex = path.slice(1).search(/[/?#]/);
  const firstSegment = delimiterIndex === -1 ? path : path.slice(0, delimiterIndex + 1);
  if (firstSegment.includes(':')) return false;

  return true;
}
