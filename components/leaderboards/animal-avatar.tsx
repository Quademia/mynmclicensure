// components/leaderboards/animal-avatar.tsx
//
// How a student shows on the leaderboards (05 G1b): their profile photo
// when they chose their name and have one, otherwise their animal — one
// of Google's Noto drawings (public/animals) on a pale teal disc. On the
// shared name circle's base (.name-circle, DS7) with a size of its own;
// the boards, the results and Profile draw it too, as they are built.
// The look is in styles/leaderboards.css.

import { animalSrc } from '@/lib/leaderboards/types';

/** A stored upload; anything else falls back to the animal. */
function isSafeSrc(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//.test(url);
}

export function AnimalAvatar({
  animal,
  photo,
  size = 48,
  lazy = false,
}: {
  animal: string;
  /** Shown instead of the animal when given (shown as their name). */
  photo?: string | null;
  size?: 32 | 48 | 64;
  /** The animal grid: only the drawings on screen are fetched. */
  lazy?: boolean;
}) {
  if (isSafeSrc(photo)) {
    return (
      <span className={`name-circle is-person lb-circle lb-circle-${size}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- a student-supplied URL of unknown host; next/image would need every host allow-listed */}
        <img src={photo} alt="" />
      </span>
    );
  }
  return (
    <span className={`name-circle lb-circle lb-circle-${size} lb-animal`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG; next/image adds nothing here */}
      <img src={animalSrc(animal)} alt="" width={size} height={size} loading={lazy ? 'lazy' : undefined} />
    </span>
  );
}
