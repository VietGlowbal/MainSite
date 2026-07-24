/**
 * Avatar — Untitled UI's avatar with the kit's "contrast border" treatment,
 * from Figma 203:12467 (the signed-in top nav).
 *
 * The three nested rings read as redundant until you see where the component
 * has to work: the same avatar sits on the black nav bar and, later, on white
 * cards. The white hairline is what separates the photo from black; the
 * translucent dark ring is what separates it from white. Drop either and the
 * avatar bleeds into one of the two backgrounds.
 *
 * 32px is the only size the design uses so far. Add sizes when a frame calls
 * for one, the way button.tsx handles its padding steps.
 */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  // Vietnamese names put the given name last ("Trần Khánh Linh" -> TL), which
  // is also what first+last gives for the English order. One rule covers both.
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const seed = `${first}${last}`.toUpperCase();
  return seed === '' ? '?' : seed;
}

export function Avatar({
  name,
  src,
  className,
}: {
  /** Used for the alt text and as the initials fallback. */
  name: string;
  src?: string | null | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={`relative size-gb-4xl shrink-0 rounded-gb-full bg-surface p-px shadow-gb-xs ring-[0.5px] ring-black/10${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="size-full overflow-hidden rounded-gb-full ring-[0.5px] ring-black/16">
        {src ? (
          /* Plain <img> rather than next/image: avatar URLs come from OAuth
             providers and user uploads, and an unconfigured host makes
             next/image throw at runtime. At 32px there is nothing to optimise.
             Same call as src/app/profile/profile-avatar.tsx. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            loading="lazy"
            className="size-full rounded-gb-full border border-white object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex size-full items-center justify-center rounded-gb-full border border-white bg-surface-muted text-gb-xs font-semibold text-fg-secondary"
          >
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  );
}
