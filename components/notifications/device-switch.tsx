// components/notifications/device-switch.tsx — the on/off switch of a
// device's notifications: the admin's "Notify this device when a student
// writes" on Messages (08.5b) and the student's switches on Profile
// (08.15; Sam, 2026-10-20). The design system has no switch (09.12, one
// for the whole app, queued), so this one is drawn on tokens in
// styles/notifications.css and shared by the notification places only.

'use client';

export function DeviceSwitch({
  on,
  busy = false,
  labelledBy,
  onFlip,
}: {
  on: boolean;
  busy?: boolean;
  /** The id of the words that name it. */
  labelledBy: string;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      className={`nsw-switch${on ? ' on' : ''}`}
      onClick={onFlip}
      disabled={busy}
    >
      <span className="nsw-knob" />
    </button>
  );
}
