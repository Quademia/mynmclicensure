// app/(app)/challenge/play/join-offer.tsx
//
// The offer to join the leaderboards (05 G1b; Sam, 2026-10-20 drawn,
// 2026-10-24), the first time a student goes to play, before the start
// screen — asked once: what the boards are, Join (How you'll appear) or
// Not now, just play (the start screen). On the quiz start screen's card.

'use client';

import { Icon } from '@/components/shell/icons';

const POINTS: { icon: Parameters<typeof Icon>[0]['name']; text: string }[] = [
  { icon: 'target', text: 'Ranked by right answers, then time.' },
  { icon: 'user', text: 'You choose how you appear: a username and an animal, or your first name.' },
  { icon: 'settings', text: 'Leave any time from Profile.' },
];

export function JoinOffer({
  pending,
  onJoin,
  onNotNow,
}: {
  pending: boolean;
  onJoin: () => void;
  onNotNow: () => void;
}) {
  return (
    <div className="preflight-card lb-offer">
      <div className="preflight-logo">Quademia Nurses Hub</div>
      <div className="lb-offer-badge" aria-hidden="true">
        <Icon name="trophy" />
      </div>
      <div className="preflight-title">Join the leaderboards?</div>
      <p className="lb-offer-lead">See where you rank on the daily challenge, in your school and across Ghana.</p>
      <ul className="challenge-rules">
        {POINTS.map((p) => (
          <li key={p.icon}>
            <span className="challenge-rule-icon">
              <Icon name={p.icon} />
            </span>
            {p.text}
          </li>
        ))}
      </ul>
      <div className="preflight-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={pending} onClick={onJoin}>
          Join
        </button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={onNotNow}>
          {pending ? 'Opening…' : 'Not now, just play'}
        </button>
      </div>
    </div>
  );
}
