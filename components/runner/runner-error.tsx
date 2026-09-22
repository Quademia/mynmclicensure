// components/runner/runner-error.tsx
//
// The runner's error card (legacy showError(title, msg) in
// runner/instant.html and runner/timed.html): the icon, the title, the
// message and "Back to Quizzes" to the student Fixed Quizzes page
// (slice 5b). Server Component; the header is hidden, as legacy hid it.

import { Icon } from '@/components/shell/icons';

export function RunnerError({ title, message }: { title: string; message: string }) {
  return (
    <div className="runner">
      <div className="runner-wrap">
        <div className="error-screen">
          <div className="error-icon"><Icon name="alert" size={36} /></div>
          <div className="error-title">{title}</div>
          <div className="error-msg">{message}</div>
          <a className="btn btn-primary" href="/student/fixed-quizzes">Back to Quizzes</a>
        </div>
      </div>
    </div>
  );
}
