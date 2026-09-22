// components/shell/chips.tsx
//
// The kind and scale chips (10-design-system.md DS11, DS12), from the
// Claude Design palettes of 2026-09-22.
//
// A badge reports a STATE and is a 6px badge; a chip here reports a
// KIND or a STEP and is a 4px label chip. That shape difference is what
// lets kind sky (hue 201°) and state info blue (224°) live in one app.
// Before this, kinds borrowed the three signal hues, so a green TF read
// as "passed" and a red TIMED_ONLY as a failure.
//
// Two rules hold the whole thing up:
//
//   · A hue means something only INSIDE its family. Sky is MCQ in a
//     question list and Fixed in an attempts list; the word always
//     rides with it, so a chip is never colour alone.
//   · Anything that is a SETTING rather than an origin gets no hue.
//     A retake is a repeat of one of the others and a mode is how a
//     quiz runs rather than what it is, so both take the grey chip.
//     That is also what stops a Learning History row — which shows a
//     mode and a kind side by side — ever putting two of one hue
//     together.

import { Icon } from './icons';
import type { IconName } from '@/lib/nav/types';

export type KindHue = 'sky' | 'indigo' | 'plum' | 'neutral';

/** Question types, in the Question Bank, the runner and the quiz picker. */
export const QUESTION_TYPE_HUE: Record<string, KindHue> = {
  MCQ: 'sky',
  TF: 'indigo',
  SATA: 'plum',
};

/** Where an attempt came from: admin Attempts and Learning History. */
export const ATTEMPT_SOURCE_HUE: Record<string, KindHue> = {
  fixed: 'sky',
  mock: 'indigo',
  builder: 'plum',
  // a repeat of one of the others, so no hue of its own
  retake: 'neutral',
};

/** Easy / moderate / hard as a three-step order. */
export const DIFFICULTY_STEP: Record<string, 1 | 2 | 3> = {
  Easy: 1,
  Moderate: 2,
  Hard: 3,
};

/** The mode a quiz is run in. Grey, with the icon carrying the meaning. */
export const MODE_ICON: Record<string, IconName | null> = {
  instant: 'zap',
  timed: 'timer',
  INSTANT_ONLY: 'zap',
  TIMED_ONLY: 'timer',
  // "both" is the absence of a restriction, so it draws nothing
  BOTH: null,
};

/**
 * A kind chip. `hue` falls back to grey, which is the right answer for
 * any value the maps above do not know — an unknown kind should read as
 * unremarkable rather than borrow a meaning.
 */
export function KindChip({
  hue = 'neutral',
  icon,
  children,
}: {
  hue?: KindHue;
  icon?: IconName | null;
  children: React.ReactNode;
}) {
  return (
    <span className={`label-chip label-chip-${hue}`}>
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  );
}

/**
 * A scale chip: the word, and three bars filling one, two or three. The
 * bars carry the order on their own, so the step survives a greyscale
 * screenshot and colour-blind eyes; the fill reinforces them.
 */
export function ScaleChip({ step, children }: { step: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <span className={`scale-chip scale-chip-${step}`}>
      <span className="scale-bars" aria-hidden="true">
        <i className={step >= 1 ? 'on' : undefined} />
        <i className={step >= 2 ? 'on' : undefined} />
        <i className={step >= 3 ? 'on' : undefined} />
      </span>
      {children}
    </span>
  );
}
