// scripts/sample-leaderboards.mjs — sample leaderboards on DEV (05 G1b; Sam,
// 2026-10-24: "create sample test users and challenges completed so that I can
// see the boards"). Not part of the app and never run against prod.
//
// WHAT IT MAKES, in one transaction (a failure keeps nothing): 76 students
// (56 RM across six schools — 14 at student4's, three more with 10+, two
// short of 10 — and 20 RN), users U_SAMPLE_nnn with lb-sample-nnn@example.test
// and a row each in the project's shared sign-in table (no password: they
// cannot sign in); their plays from FIRST_DAY to TODAY (PS_nnn_yyyymmdd), a
// spread of skill and speed, about three in four playing on TODAY; each
// joined, about a third shown by name. Past days nobody opened get a paper
// with no questions for the plays to point at; TODAY's papers are made the
// real way. A fixed seed: a re-run makes the same people and scores.
//
// USAGE (from the repo root; DB_URL is read from .env.local only):
//   node scripts/sample-leaderboards.mjs --dev            add
//   node scripts/sample-leaderboards.mjs --dev --remove   remove all of it
// FIRST_DAY and TODAY below are the run's window: move TODAY to the day of
// a new run (its plays are made earlier that day, UTC).

import fs from 'node:fs';
import postgres from 'postgres';

if (!process.argv.includes('--dev')) {
  console.error('Refused: this writes sample students to the DEV database. Run with --dev.');
  process.exit(1);
}
const remove = process.argv.includes('--remove');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.split(/\r?\n/).find((l) => l.startsWith('DB_URL='))?.slice(7).trim();
if (!url) {
  console.error('No DB_URL in .env.local.');
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, ssl: 'require', onnotice: () => {} });

// a fixed seed, so a re-run makes the same people and scores
let s = 20261024;
const rand = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rand() * a.length)];

const FIRST = ['Ama', 'Kofi', 'Akosua', 'Kwame', 'Abena', 'Yaw', 'Efua', 'Kwabena', 'Adwoa', 'Kojo', 'Esi', 'Kwesi', 'Afia', 'Fiifi', 'Akua', 'Ekow', 'Yaa', 'Nana', 'Adjoa', 'Kweku', 'Mansa', 'Selorm', 'Elikem', 'Dzifa', 'Sena', 'Mawuli', 'Fatima', 'Abdul', 'Zainab', 'Rashid', 'Salamatu', 'Iddrisu', 'Comfort', 'Gifty', 'Prince', 'Mercy', 'Emmanuel', 'Grace', 'Benedicta', 'Joyce'];
const LAST = ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Osei', 'Agyeman', 'Appiah', 'Darko', 'Ofori', 'Amoah', 'Addo', 'Tetteh', 'Quaye', 'Lamptey', 'Nkrumah', 'Acheampong', 'Sarpong', 'Gyamfi', 'Danso', 'Bonsu', 'Agbeko', 'Dzeagu', 'Mahama', 'Alhassan', 'Yakubu', 'Fuseini', 'Annan', 'Aidoo', 'Ansah', 'Frimpong'];

// where they study: RM (student4's programme) and RN
const GROUPS = [
  { program: 'RM', school: 32, n: 14 }, // student4's school
  { program: 'RM', school: 7, n: 12 },
  { program: 'RM', school: 87, n: 11 },
  { program: 'RM', school: 104, n: 10 },
  { program: 'RM', school: 69, n: 6 }, // waits: needs 4 more
  { program: 'RM', school: 54, n: 3 }, // waits: needs 7 more
  { program: 'RN', school: 27, n: 8 },
  { program: 'RN', school: 1, n: 7 },
  { program: 'RN', school: 100, n: 5 },
];

const FIRST_DAY = '2026-10-04';
const TODAY = '2026-10-24';

function days() {
  const out = [];
  for (let d = new Date(`${FIRST_DAY}T00:00:00Z`); d <= new Date(`${TODAY}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

try {
  await sql.begin(async (tx) => {
    if (remove) {
      const p = await tx`delete from licensure_gh.challenge_plays where user_id like 'U_SAMPLE_%'`;
      const c = await tx`delete from licensure_gh.leaderboard_cards where user_id like 'U_SAMPLE_%'`;
      const auth = await tx`select auth_id from licensure_gh.users where user_id like 'U_SAMPLE_%'`;
      const u = await tx`delete from licensure_gh.users where user_id like 'U_SAMPLE_%'`;
      const a = auth.length ? await tx`delete from auth.users where id in ${tx(auth.map((r) => r.auth_id))} and email like 'lb-sample-%@example.test'` : { count: 0 };
      // past papers with no questions and no plays left
      const papers = await tx`
        delete from licensure_gh.challenge_days cd
        where cd.day < ${TODAY}::date
          and not exists (select 1 from licensure_gh.challenge_day_items i where i.challenge_id = cd.challenge_id)
          and not exists (select 1 from licensure_gh.challenge_plays p where p.challenge_id = cd.challenge_id)`;
      console.log(`removed: ${p.count} plays, ${c.count} cards, ${u.count} users, ${a.count} sign-in rows, ${papers.count} empty past papers`);
      return;
    }

    const [{ n: already }] = await tx`select count(*)::int n from licensure_gh.users where user_id like 'U_SAMPLE_%'`;
    if (already) throw new Error(`sample already there (${already} users) — remove it first`);

    const words = (await tx`select licensure_gh.leaderboard_words() w`)[0].w;
    const animals = (await tx`select licensure_gh.leaderboard_animals() a`)[0].a;

    // today's RN paper, made the real way (with its questions), if no one opened it yet
    await tx`select licensure_gh._challenge_paper('RN', ${TODAY}::date)`;
    await tx`select licensure_gh._challenge_paper('RM', ${TODAY}::date)`;

    // past days without a paper: an empty paper for the plays to point at
    const allDays = days();
    for (const program of ['RM', 'RN']) {
      for (const day of allDays.filter((d) => d < TODAY)) {
        await tx`
          insert into licensure_gh.challenge_days (challenge_id, day, program_id, course_id)
          values (${`CH_${program}_${day.replace(/-/g, '')}`}, ${day}::date, ${program}, 'GP')
          on conflict (day, program_id) do nothing`;
      }
    }
    const papers = await tx`select challenge_id, day::text as day, program_id from licensure_gh.challenge_days where day between ${FIRST_DAY}::date and ${TODAY}::date`;
    const paperOf = new Map(papers.map((p) => [`${p.program_id}:${p.day}`, p.challenge_id]));

    let k = 0;
    let plays = 0;
    const used = new Set();
    for (const g of GROUPS) {
      for (let i = 0; i < g.n; i++) {
        k += 1;
        const nnn = String(k).padStart(3, '0');
        const userId = `U_SAMPLE_${nnn}`;
        const email = `lb-sample-${nnn}@example.test`;
        let forename, surname;
        do { forename = pick(FIRST); surname = pick(LAST); } while (used.has(forename + surname));
        used.add(forename + surname);

        const [{ id: authId }] = await tx`
          insert into auth.users (id, instance_id, aud, role, email)
          values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${email})
          returning id`;
        await tx`
          insert into licensure_gh.users (user_id, auth_id, email, forename, surname, name, program_id, role, active, school_id, signup_source, created_utc)
          values (${userId}, ${authId}, ${email}, ${forename}, ${surname}, ${`${forename} ${surname}`}, ${g.program}, 'STUDENT', true, ${g.school}, 'SAMPLE', now() - interval '40 days')`;

        // how good and how often: a spread across the board
        const skill = 0.3 + rand() * 0.62;
        const often = 0.45 + rand() * 0.5;
        const pace = 0.25 + rand() * 0.6;
        for (const day of allDays) {
          const today = day === TODAY;
          if (rand() > (today ? 0.75 : often)) continue;
          const challengeId = paperOf.get(`${g.program}:${day}`);
          if (!challengeId) continue;
          let right = 0;
          for (let q = 0; q < 5; q++) if (rand() < skill) right += 1;
          const t = Math.min(300, Math.max(35, Math.round(300 * (pace + (rand() - 0.5) * 0.3))));
          // today's plays are earlier today (UTC), past days' in the day
          const hour = today ? 6 + Math.floor(rand() * 10) : 6 + Math.floor(rand() * 14);
          const started = new Date(`${day}T${String(hour).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}:00Z`);
          await tx`
            insert into licensure_gh.challenge_plays
              (play_id, user_id, day, challenge_id, school_id, started_utc, ends_utc, submitted_utc, status, time_taken_s, right_count, out_of)
            values (${`PS_${nnn}_${day.replace(/-/g, '')}`}, ${userId}, ${day}::date, ${challengeId}, ${g.school},
                    ${started}, ${new Date(started.getTime() + 300000)}, ${new Date(started.getTime() + t * 1000)},
                    ${t >= 300 ? 'time_up' : 'submitted'}, ${t}, ${right}, 5)`;
          plays += 1;
        }

        // joined, about a third shown by name
        await tx`select licensure_gh.leaderboard_join(${userId}, ${rand() < 0.33 ? 'name' : 'username'}, ${pick(words)}, ${pick(animals)})`;
      }
    }
    console.log(`added: ${k} sample students, ${plays} plays, all joined`);
  });
} catch (e) {
  console.error('FAILED (nothing kept):', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
