// components/runner/runner-error.tsx
//
// The runner's error card (legacy showError(title, msg) in
// runner/instant.html and runner/timed.html): the icon, the title, the
// message and the way back — since 03 Q8 the sitting's own home once the
// attempt is known (links.ts), else Fixed Quizzes as legacy. Server
// Component; the header is hidden, as legacy hid it.

import { Icon } from '@/components/shell/icons';
import { SESSION_EXITS, type SessionExit } from '@/lib/attempts/links';

export function RunnerError({ title, message, exit = SESSION_EXITS.fixed }: { title: string; message: string; exit?: SessionExit }) {
  return (
    <div className="runner">
      <div className="runner-wrap">
        <div className="error-screen">
          <div className="error-icon"><Icon name="alert" size={36} /></div>
          <div className="error-title">{title}</div>
          <div className="error-msg">{message}</div>
          <a className="btn btn-primary" href={exit.href}>{exit.label}</a>
        </div>
      </div>
    </div>
  );
}
