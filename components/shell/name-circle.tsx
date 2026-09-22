// components/shell/name-circle.tsx
//
// The one name circle (10-design-system.md DS7, Sam 2026-09-22),
// replacing the five drawn separately by the profile page, the top
// bar, both message pages and the old sidebar. Two kinds:
//
//   · A PERSON — their photo when they have one, otherwise two initials
//     in white on the teal-to-navy blend borrowed from MyNclex's tutor
//     circle (--avatar-gradient). Students and admins alike: an admin
//     signed in is a person.
//   · QUADEMIA — the Quademia logo, wherever Quademia itself is the
//     speaker (a reply in Messages today; anywhere later). Messaging is
//     the one place both kinds sit in one view, which is what the
//     second kind is for.
//
// The logo is the painted Q on the teal disc — public/images/
// quademia-mark.png, the same file as app/icon.png, the mark MyNclex
// has carried since 2026-08-22. It is Sam's symbol; the vector redraw
// in the 2026-08-12 artifact was a proposal and was never adopted
// (Sam, 2026-09-22), so it is not used anywhere.
//
// Sizes are named classes rather than an inline width, so a surface's
// phone rule can still shrink one (the profile's 80 → 64). The look is
// in styles/components.css (.name-circle*).

export type NameCircleSize = 'xs' | 'sm' | 'md' | 'lg';

const QUADEMIA_MARK = '/images/quademia-mark.png';

/** Two uppercase initials, as the profile page and the sidebar drew them. */
export function initialsOf(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** A stored upload, or the profile page's local preview. */
function isSafeSrc(url: string | null | undefined): url is string {
  return !!url && /^(https?:\/\/|data:image\/)/.test(url);
}

export function NameCircle({
  who = 'person',
  name = '',
  avatarUrl,
  size = 'sm',
  alt = '',
  className,
}: {
  who?: 'person' | 'quademia';
  name?: string;
  avatarUrl?: string | null;
  size?: NameCircleSize;
  /** For a photo; initials and the logo are decorative beside a name. */
  alt?: string;
  className?: string;
}) {
  const cls = ['name-circle', `name-circle-${size}`, who === 'quademia' ? 'is-quademia' : 'is-person', className]
    .filter(Boolean)
    .join(' ');

  if (who === 'quademia') {
    return (
      <span className={cls}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 512px static asset drawn at 26–32px; next/image adds nothing here */}
        <img src={QUADEMIA_MARK} alt={alt || 'Quademia'} />
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden={alt ? undefined : true}>
      {isSafeSrc(avatarUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element -- a student-supplied URL of unknown host, or a data: preview; next/image would need every host allow-listed
        <img src={avatarUrl} alt={alt} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
