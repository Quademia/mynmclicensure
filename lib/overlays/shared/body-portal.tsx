// lib/overlays/shared/body-portal.tsx
//
// Every overlay is portalled to <body> (AGENTS.md, Known Workarounds): a
// transformed or container-typed ancestor would otherwise become the
// containing block of a position:fixed panel with no error. The legacy
// pages placed their side panels and modals as direct children of
// <body>; this keeps them there.
//
// Renders nothing on the server and on the first client paint (there is
// no document yet), then the portal. useSyncExternalStore is the
// lint-clean "am I on the client" read.

'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};

export function BodyPortal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}
