// components/shell/please-wait.tsx
//
// The please-wait screen (09.14; Sam, 2026-10-19, drawn by a cloud
// session; placed 2026-10-20): for a wait of seconds that holds the whole
// screen — the quiz loading after Start, Submit, Save & Exit. Not for a
// move between pages (the grey placeholder, page-loading.tsx) and not for
// a quick action (the button's words change). The Q in a spinning teal
// ring, the place's own line, the wordmark's words at the foot; after
// 8 seconds a note that the connection is slow, so a long wait on weak
// data does not look like a broken app. A new message keeps the same
// screen and its count, so one wait that changes its words (Submit, then
// "Quiz submitted.") is one wait.
//
// Portalled to <body> like every overlay (AGENTS.md), so it draws only in
// the browser: a place shows it after a tap, never on the server's first
// paint. The look is styles/loading.css.

'use client';

import { useEffect, useState } from 'react';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { Icon } from '@/components/shell/icons';
import '@/styles/loading.css';

const SLOW_AFTER_MS = 8000;

// The 192px copy of the Q (18 KB, not the 91 KB original): it must show
// on a weak signal, drawn at 72px.
const MARK_192 = '/images/quademia-mark-192.png';

export function PleaseWait({ message, detail }: { message: string; detail?: string }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <BodyPortal>
      <div className="please-wait" role="status" aria-live="polite">
        <div className="pw-middle">
          <div className="pw-ring">
            {/* eslint-disable-next-line @next/next/no-img-element -- a 192px static asset drawn at 72px; next/image adds nothing here */}
            <img className="pw-mark" src={MARK_192} alt="" width={72} height={72} />
          </div>
          <p className="pw-message">{message}</p>
          {detail ? <p className="pw-detail">{detail}</p> : null}
          {slow ? (
            <div className="pw-slow">
              <Icon name="signal" />
              <p>
                <strong>Still loading — your connection is slow.</strong>
                <br />
                Please keep this page open.
              </p>
            </div>
          ) : null}
        </div>
        <div className="pw-foot wordmark-text" aria-hidden="true">
          <span>Quademia</span>
          <b>MyNMCLicensure</b>
        </div>
      </div>
    </BodyPortal>
  );
}
