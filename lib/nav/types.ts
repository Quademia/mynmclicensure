// lib/nav/types.ts
//
// The sidebar as data (AGENTS.md folder convention #4). Each audience
// exports a NavItem[] in the legacy sidebar's order; the shared sidebar
// renders it. Adding, removing or reordering an entry is one line in
// one file.

/**
 * The icon set's names (10-design-system.md DS6, widened by DS15 pass B).
 * Each has a drawing in components/shell/icons.tsx; a name not listed
 * here fails the build.
 *
 * The first nineteen arrived with the sidebar, which is why the type
 * lives in `lib/nav/`. DS15 pass B added the rest for buttons, section
 * headings and empty states, so the name is `IconName` now and the set
 * is the app's, not the navigation's. `NavIcon` stays as an alias
 * because `NavItem.icon` reads better with it.
 */
export type IconName =
  // the nineteen from DS6, drawn for the two sidebars
  | 'home'
  | 'book'
  | 'clipboard'
  | 'target'
  | 'wrench'
  | 'chart'
  | 'megaphone'
  | 'download'
  | 'stethoscope'
  | 'help'
  | 'message'
  | 'send'
  | 'phone'
  | 'users'
  | 'card'
  | 'banknote'
  | 'package'
  | 'folder'
  | 'settings'
  // DS15 pass B: buttons, section headings, empty states
  | 'save'
  | 'trash'
  | 'pencil'
  | 'refresh'
  | 'flag'
  | 'alert'
  | 'inbox'
  | 'timer'
  | 'book-open'
  | 'link'
  | 'square'
  | 'graduation'
  | 'user'
  | 'zap'
  | 'hourglass'
  | 'search'
  | 'ticket'
  | 'key'
  | 'ban'
  | 'lock'
  | 'eye'
  | 'check-circle'
  | 'grid'
  | 'pointer'
  | 'play'
  | 'upload'
  | 'x';

/** The nav row's icon. Every icon name is allowed; see IconName. */
export type NavIcon = IconName;

export type NavItem = {
  /** Stable key — used for dropdown state, badges and the active test. */
  key: string;
  /** Rendered text, exactly as the legacy sidebar showed it, minus the emoji (DS6). */
  label: string;
  /** The row's icon, drawn before the label. Absent on a dropdown's child rows. */
  icon?: NavIcon;
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
};

/** One page of a phone tab's group — a tab in the row at the top. */
export type PhoneTabPage = {
  label: string;
  href: string;
  /** Only this address, not the addresses under it (My packs, not Build). */
  exact?: boolean;
};

/**
 * A tab of the student's bottom bar on a phone (Sam, 2026-10-04; 00 The
 * menu). The bar's four tabs never change; a group's pages sit in a row
 * at the top of those pages, and a row of one is not drawn. A tap on the
 * tab opens the group's first page.
 */
export type PhoneTab = {
  key: string;
  label: string;
  icon: NavIcon;
  pages: PhoneTabPage[];
  /** Addresses that belong to the group without a row: the tab is lit there. */
  also?: string[];
};
