// app/(app)/student/offline-packs/page.tsx — My packs (07.8; Sam,
// 2026-10-15: C, like Practice Papers, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm — in place of A, the
// course sections built first).
//
// One card per course the student can make packs from (the pack door), as
// Practice Papers' first page: its name, the package's allowance as a bar
// ("2 made · 3 left"; no bar with no limit or past ten), and a foot line
// that only tells ("2 packs · newest: …", or "Build a pack"). The whole
// card is one tap, opening that course's packs (course/[course_id]). A
// course whose package has ended but holds packs gets its card too, "Made
// with an earlier package". A trial or free student gets the locked card; a
// student with no pack yet, the one-line way in. No filters, counts or ids
// (Sam). The page stays three calm cards however many packs are made.
//
// On this phone (07.3): the page tells the phone which packs are still the
// student's, so one deleted elsewhere leaves it, and shows the quiet line on
// how to install the app (components/install-app). Offline, the phone shows
// its own copy of the packs (app/offline), a flat list, instead.
//
// A Server Component: two reads (the door, the packs), the course titles
// the catalogue already holds and Config's check-in period; nothing waits
// on the browser.

import type { Metadata } from 'next';
import { requireStudent } from '@/lib/access';
import { getConfig, getCourses } from '@/lib/catalogue/queries';
import { getPackDoor } from '@/lib/offline-packs/door';
import { checkinDaysOf, listMyPacks } from '@/lib/offline-packs/queries';
import { PageHeader } from '@/components/shell/page-header';
import { AppLink } from '@/components/shell/link-pending';
import { InstallAppLine } from '@/components/install-app/install-app';
import { PhonePrune } from './phone-pack';
import { CourseCard } from './pack-parts';
import '@/styles/practice-papers.css';
import '@/styles/courses.css';
import '@/styles/student-offline-packs.css';

export const metadata: Metadata = {
  title: 'My packs | MyNMCLicensure',
};

export const dynamic = 'force-dynamic';

const PACKAGES_HREF = '/student/upgrade';

export default async function MyPacksPage() {
  const gate = await requireStudent();
  const [door, packs, courses, config] = await Promise.all([
    getPackDoor(gate),
    listMyPacks(gate.supabase, gate.profile.user_id),
    getCourses(gate.supabase),
    getConfig(gate.supabase),
  ]);
  const titles: Record<string, string> = Object.fromEntries(courses.map((c) => [c.course_id, c.title]));
  const mine = packs ?? [];
  const open = new Set(door.map((c) => c.course_id));
  // courses whose package has ended, holding packs made under it (newest first)
  const earlierIds = [...new Set(mine.filter((p) => !open.has(p.course_id)).map((p) => p.course_id))];

  return (
    <div className="pp-page opk">
      <PageHeader title="My packs" subtitle="Packs of questions to practise anywhere, even with no signal." />

      {door.length || mine.length ? <InstallAppLine /> : null}
      {packs !== null ? (
        <PhonePrune userId={gate.profile.user_id} activeIds={mine.map((p) => p.pack_id)} checkinDays={checkinDaysOf(config)} />
      ) : null}

      {packs === null ? <p className="pp-note">Your packs could not be loaded. Please refresh the page.</p> : null}

      {!door.length ? (
        <div className="card pp-card">
          <span className="pp-big">Offline packs come with a package</span>
          <span className="pp-line">With a package you can make packs of questions, practise them on your phone with no signal, and print them.</span>
          <AppLink href={PACKAGES_HREF} className="btn btn-primary btn-lg pp-package">
            Choose a package
          </AppLink>
        </div>
      ) : !mine.length ? (
        <div className="card pp-card">
          <span className="pp-big">Make a pack to practise offline</span>
          <span className="pp-line">
            Pick questions from a course. The pack stays on your phone, so you can practise with no signal, and you can print it.
          </span>
        </div>
      ) : null}

      {door.length || earlierIds.length ? (
        <ul className="cp-grid">
          {door.map((c) => (
            <li key={c.course_id}>
              <CourseCard
                courseId={c.course_id}
                title={c.title}
                packs={mine.filter((p) => p.course_id === c.course_id)}
                allowance={{ allowed: c.packsAllowed, left: c.packsLeft }}
              />
            </li>
          ))}
          {earlierIds.map((id) => (
            <li key={id}>
              <CourseCard courseId={id} title={titles[id] ?? id} packs={mine.filter((p) => p.course_id === id)} allowance={null} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
