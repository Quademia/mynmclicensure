// lib/nav/types.ts
//
// The sidebar as data (AGENTS.md folder convention #4). Each audience
// exports a NavItem[] in the legacy sidebar's order; the shared sidebar
// renders it. Adding, removing or reordering an entry is one line in
// one file.

export type NavItem = {
  /** Stable key — used for dropdown state, badges and the active test. */
  key: string;
  /** Rendered text, emoji included, exactly as the legacy sidebar showed it. */
  label: string;
  /** Route or URL. Absent on a dropdown parent. */
  href?: string;
  /** Opens in a new tab (the WhatsApp / Telegram channel links). */
  external?: boolean;
  /** A dropdown: rendered as a toggle with these rows beneath it. */
  children?: NavItem[];
  /** The Messages badge slot: the count comes from the layout (slice 12). */
  badge?: 'messages';
  /**
   * In the data, not on screen. The Telegram item waits for slice 17
   * (rebuild.md §9 #10); the sidebar must never show a dead link.
   */
  hidden?: boolean;
  /** "My Courses": rows come from the student's course access at runtime. */
  dynamic?: 'courses';
  /** "My Account": avatar/initials + the student's name as the toggle. */
  account?: boolean;
  /** A thin rule above this item (the legacy .sidebar-account-divider). */
  dividerAbove?: boolean;
};
