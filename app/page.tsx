// app/page.tsx — legacy/mynmclicensure/index.html, the product's public
// landing page (slice 3). A Server Component: the programme cards read
// `programs` with the anon client (readable before login), ordered by
// program_id as the legacy script did.
//
// What changed on the way, and why (session log 2026-09-11):
//   - Brand: "QAcademy" → "Quademia" wherever a reader sees it (AGENTS.md
//     UI convention #5); the logo image is gone (the product has none),
//     the nav carries the same wordmark as the login page.
//   - The two umbrella pages (the QAcademy landing and the product
//     chooser) are not rebuilt: Sign In goes straight to /login, and the
//     footer's "Back to" link points at the parent site via
//     parentSiteOrigin() — never a literal.
//   - The MyTeacher nav link left with the April split.
//   - The "paid plans are paused" switch is lifted (Sam, 2026-09-11) so
//     the buttons can be tested; /subscribe and /student/upgrade arrive
//     with slices 7 and 9 and 404 until then.

import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import { PublicFooter } from '@/components/shell/public-footer';
import '@/styles/landing.css';

export const metadata: Metadata = {
  title: 'MyNMCLicensure | Quademia',
};

export const dynamic = 'force-dynamic';

type ProgCard = { program_id: string; program_name: string };

export default async function LandingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('programs').select('program_id, program_name').order('program_id');
  const programs = (error ? [] : (data ?? [])) as ProgCard[];

  return (
    <div className="landing">
      {/* NAV — the shared public bar (2026-09-22). The tagline that used
          to sit under the brand here moves to the hero: a bar shown to
          someone halfway through paying should not carry marketing. */}
      <PublicTopBar />

      {/* HERO */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-pill"><span className="hero-pill-dot" />NMC Ghana Exam Prep</div>
            <h1>Pass your NMC exam.<br />Study smarter with <em>confidence.</em></h1>
            <p className="hero-sub">Ghana&apos;s dedicated practice platform for nursing licensure candidates — quizzes, rationales, mock exams, and progress tracking built around your programme.</p>
            <div className="hero-trial-badge">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1l1.9 3.8L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1-3-2.9 4.1-.8z" /></svg>
              Free trial access on registration — no payment needed to start
            </div>
            <div className="cta-row">
              <a href="/register" className="btn-hero-p">Create Free Account</a>
              <a href="/login" className="btn-hero-g">Sign In</a>
            </div>
            <p className="hero-already">Already registered? <a href="/subscribe">Subscribe to full access →</a></p>
          </div>

          {/* HERO VISUAL — quiz UI mockup */}
          <div className="hero-vis">
            <svg width="100%" viewBox="0 0 460 380" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="460" height="380" rx="14" fill="#0d1f35" />
              <rect x="0" y="0" width="460" height="38" rx="14" fill="#1a2e48" />
              <rect x="0" y="20" width="460" height="18" fill="#1a2e48" />
              <circle cx="20" cy="19" r="5" fill="#dc2626" opacity=".65" />
              <circle cx="36" cy="19" r="5" fill="#d97706" opacity=".65" />
              <circle cx="52" cy="19" r="5" fill="#16a34a" opacity=".65" />
              <rect x="76" y="10" width="210" height="16" rx="8" fill="#142d4c" />
              <text x="181" y="22" fontSize="9" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif">licensure.quademia.com</text>

              <rect x="0" y="38" width="96" height="342" fill="#142d4c" />
              <text x="48" y="68" fontSize="8.5" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif" fontWeight="600">Dashboard</text>
              <rect x="10" y="76" width="76" height="24" rx="5" fill="#1e3a5f" />
              <text x="48" y="91" fontSize="8" fill="#5dcfc8" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">Practice Quiz</text>
              <text x="48" y="116" fontSize="8" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif">Mock Exams</text>
              <text x="48" y="136" fontSize="8" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif">History</text>
              <text x="48" y="156" fontSize="8" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif">Download</text>
              <rect x="10" y="330" width="76" height="28" rx="6" fill="#2d7d72" opacity=".2" />
              <rect x="10" y="330" width="76" height="28" rx="6" fill="none" stroke="#2d7d72" strokeWidth="1" />
              <text x="48" y="348" fontSize="8" fill="#5dcfc8" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">Subscribe ↑</text>

              <rect x="108" y="46" width="340" height="30" rx="0" fill="#0d1f35" />
              <text x="118" y="65" fontSize="9" fill="#b0c8d8" fontFamily="sans-serif" fontWeight="700">Registered General Nursing · Anatomy &amp; Physiology</text>
              <rect x="108" y="76" width="340" height="22" fill="#1a2e48" />
              <text x="118" y="91" fontSize="8" fill="#4a7a9b" fontFamily="sans-serif">Question 14 of 30</text>
              <rect x="200" y="84" width="160" height="7" rx="3" fill="#142d4c" />
              <rect x="200" y="84" width="74" height="7" rx="3" fill="#2d7d72" />
              <text x="390" y="91" fontSize="8" fill="#5dcfc8" fontFamily="sans-serif" textAnchor="end">⏱ 22:14</text>

              <rect x="108" y="104" width="340" height="264" rx="0" fill="#1e3a5f" />
              <rect x="118" y="112" width="60" height="16" rx="4" fill="#2d7d72" opacity=".25" />
              <rect x="118" y="112" width="60" height="16" rx="4" fill="none" stroke="#2d7d72" strokeWidth="1" />
              <text x="148" y="123" fontSize="8" fill="#5dcfc8" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">MCQ</text>
              <text x="192" y="123" fontSize="8" fill="#4a7a9b" fontFamily="sans-serif">Anatomy · Medium</text>

              <text x="118" y="144" fontSize="8.5" fill="#e5e7eb" fontFamily="sans-serif">The sinoatrial (SA) node is located in which chamber</text>
              <text x="118" y="156" fontSize="8.5" fill="#e5e7eb" fontFamily="sans-serif">of the heart, and what is its primary function?</text>

              <rect x="118" y="166" width="310" height="26" rx="5" fill="#142d4c" />
              <circle cx="131" cy="179" r="5" fill="none" stroke="#4a7a9b" strokeWidth="1.5" />
              <text x="143" y="183" fontSize="8" fill="#9ab0c2" fontFamily="sans-serif">A.  Left atrium — pumps oxygenated blood to the body</text>

              <rect x="118" y="197" width="310" height="26" rx="5" fill="#1a4060" />
              <rect x="118" y="197" width="310" height="26" rx="5" fill="none" stroke="#2d7d72" strokeWidth="1" />
              <circle cx="131" cy="210" r="5" fill="#2d7d72" />
              <circle cx="131" cy="210" r="2.5" fill="#fff" />
              <text x="143" y="214" fontSize="8" fill="#ffffff" fontFamily="sans-serif">B.  Right atrium — initiates the electrical impulse</text>
              <rect x="390" y="200" width="32" height="18" rx="4" fill="#16a34a" opacity=".18" />
              <text x="406" y="212" fontSize="7.5" fill="#4ade80" textAnchor="middle" fontFamily="sans-serif" fontWeight="700">✓ Ans</text>

              <rect x="118" y="228" width="310" height="26" rx="5" fill="#142d4c" />
              <circle cx="131" cy="241" r="5" fill="none" stroke="#4a7a9b" strokeWidth="1.5" />
              <text x="143" y="245" fontSize="8" fill="#9ab0c2" fontFamily="sans-serif">C.  Left ventricle — controls heart rate</text>

              <rect x="118" y="259" width="310" height="26" rx="5" fill="#142d4c" />
              <circle cx="131" cy="272" r="5" fill="none" stroke="#4a7a9b" strokeWidth="1.5" />
              <text x="143" y="276" fontSize="8" fill="#9ab0c2" fontFamily="sans-serif">D.  Bundle of His — relays signals between chambers</text>

              <rect x="118" y="294" width="310" height="64" rx="6" fill="#0d1f35" />
              <rect x="118" y="294" width="4" height="64" rx="2" fill="#5dcfc8" />
              <text x="130" y="309" fontSize="7.5" fill="#7ecdc6" fontFamily="sans-serif" fontWeight="700">Rationale</text>
              <text x="130" y="323" fontSize="7.5" fill="#9ab0c2" fontFamily="sans-serif">The SA node sits in the wall of the right atrium and acts as</text>
              <text x="130" y="335" fontSize="7.5" fill="#9ab0c2" fontFamily="sans-serif">the heart&apos;s natural pacemaker, firing 60–100 impulses/min.</text>
              <rect x="356" y="345" width="68" height="10" rx="2" fill="#142d4c" />
              <text x="390" y="353" fontSize="7" fill="#4a7a9b" textAnchor="middle" fontFamily="sans-serif">Next question →</text>
            </svg>
          </div>
        </div>
      </section>

      {/* SOCIALS */}
      <div className="socials-strip">
        <span className="socials-label">Follow &amp; stay updated</span>
        <div className="socials-btns">
          <a className="sbtn teal" href="https://t.me/QAcademynurseshub" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.03 15.47 8.9 19.1c.3 0 .44-.13.6-.28l1.44-1.38 2.99 2.2c.55.3.94.14 1.09-.51l1.98-9.32c.18-.84-.3-1.17-.86-.96L4.9 11.2c-.82.32-.8.78-.14.99l3.48 1.09 8.08-5.11-7.3 7.3z" /></svg>
            Telegram
          </a>
          <a className="sbtn teal" href="https://www.whatsapp.com/channel/0029Vb6ActpBA1ewCfBmAF3O" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 3.9A9.9 9.9 0 0 0 12.06 2C6.55 2 2 6.55 2 12.06c0 1.77.46 3.46 1.25 4.93L2 22l5.13-1.2a9.9 9.9 0 0 0 4.93 1.25C17.55 22 22 17.45 22 11.94A9.9 9.9 0 0 0 20 3.9Zm-7.94 16.1a8.1 8.1 0 0 1-4.13-1.14l-.3-.18-3.04.7.65-2.96-.2-.31a8.16 8.16 0 1 1 7.02 3.89Zm4.65-6.14c-.25-.12-1.48-.73-1.7-.81-.22-.08-.38-.12-.54.12-.16.25-.62.81-.76.98-.14.16-.28.18-.53.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.48-1.38-1.73-.14-.25-.02-.39.1-.51.1-.1.25-.28.37-.41.12-.14.16-.23.24-.39.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.14 3.64.58.25 1.04.4 1.4.51.59.19 1.12.16 1.54.1.47-.07 1.48-.6 1.69-1.17.21-.57.21-1.06.15-1.17-.06-.1-.23-.16-.48-.28Z" /></svg>
            WhatsApp
          </a>
          <a className="sbtn teal" href="https://www.tiktok.com/@qacademynurses" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.2 2h2.12c.14 1.3.78 2.38 1.78 3.18.9.7 1.96 1.1 3.1 1.18v2.14c-1.77-.02-3.46-.6-4.88-1.64v7.27a6.93 6.93 0 1 1-6.93-6.93c.25 0 .5.02.74.05v2.2a4.73 4.73 0 1 0 4.73 4.73V2Z" /></svg>
            TikTok
          </a>
          <a className="sbtn red" href="https://www.youtube.com/@QAcademyNursesHub" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8ZM9.6 15.5V8.5L15.9 12l-6.3 3.5Z" /></svg>
            YouTube
          </a>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-strip">
        <div className="stat"><span className="stat-num">5</span><span className="stat-lbl">Programmes</span></div>
        <div className="stat"><span className="stat-num">460+</span><span className="stat-lbl">Practice questions</span></div>
        <div className="stat"><span className="stat-num">2</span><span className="stat-lbl">Quiz modes</span></div>
        <div className="stat"><span className="stat-num">Free</span><span className="stat-lbl">Trial on signup</span></div>
        <div className="stat"><span className="stat-num">PDF</span><span className="stat-lbl">Offline packs</span></div>
      </div>

      {/* CHOOSE YOUR PATH */}
      <section className="section paths-section">
        <div className="section-inner">
          <p className="kicker">Get started</p>
          <h2 className="section-h">Where do you start?</h2>
          <p className="section-sub">Whether you&apos;re new or returning, find the right door for you.</p>
          <div className="path-grid">
            <div className="path-card">
              <div className="path-icon-wrap">
                <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L3 7v5c0 4.4 3.3 8.5 9 10 5.7-1.5 9-5.6 9-10V7l-9-5z" /></svg>
              </div>
              <span className="path-tag">New student</span>
              <div className="path-title">Start Free Trial</div>
              <p className="path-blurb">Register for free and get instant trial access. No payment needed — start practising today.</p>
              <a href="/register" className="path-btn teal">Create Free Account</a>
            </div>

            <div className="path-card featured">
              <div className="path-icon-wrap">
                <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l2.1 4.2L18 7.4l-3.5 3.4.8 4.8L11 13.3l-4.3 2.3.8-4.8L4 7.4l4.9-.7z" /></svg>
              </div>
              <span className="path-tag">Recommended</span>
              <div className="path-title">Subscribe to Full Access</div>
              <p className="path-blurb">Unlock all quizzes, mock exams, PDF downloads, and your Telegram study community.</p>
              <a href="/subscribe" className="path-btn white">Subscribe Now</a>
            </div>

            <div className="path-card">
              <div className="path-icon-wrap">
                <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="16" height="9" rx="2" /><path d="M7 11V7a4 4 0 0 1 8 0v4" /></svg>
              </div>
              <span className="path-tag">Returning student</span>
              <div className="path-title">Sign In</div>
              <p className="path-blurb">Already have an account? Sign in to your dashboard, continue quizzes, and check your history.</p>
              <a href="/login" className="path-btn outline">Sign In to Portal</a>
            </div>

            <div className="path-card">
              <div className="path-icon-wrap">
                <svg viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4v5h5" /><path d="M19.4 9A9 9 0 0 0 5.6 5.6L4 9m14 9v-5h-5" /><path d="M3.6 14a9 9 0 0 0 13.8 3.4L19 14" /></svg>
              </div>
              <span className="path-tag">Existing subscriber</span>
              <div className="path-title">Extend / Upgrade</div>
              <p className="path-blurb">Subscription expiring or want to add a new product? Log in and go to your account to upgrade.</p>
              <a href="/student/upgrade" className="path-btn outline">Upgrade My Access</a>
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMMES — from the database */}
      <section className="section prog-section">
        <div className="section-inner">
          <p className="kicker">Supported programmes</p>
          <h2 className="section-h">All NMC nursing programmes covered</h2>
          <p className="section-sub">Register with your programme and the platform tailors all content — quizzes, courses, and mock exams — to match your licensure pathway.</p>
          <div className="prog-grid">
            {programs.length === 0 ? (
              <p className="prog-loading">Programmes loading…</p>
            ) : (
              programs.map((p) => (
                <div key={p.program_id} className="prog-card">
                  <span className="prog-badge">{p.program_id}</span>
                  <div className="prog-name">{p.program_name}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* EXAM STRUCTURE */}
      <section className="section exam-section">
        <div className="section-inner narrow">
          <p className="kicker">About the exam</p>
          <h2 className="section-h">How the NMC Ghana licensure exam is structured</h2>
          <p className="section-sub tight">Most programmes are assessed through <strong>five parts</strong>: two programme-specific MCQ papers, a shared General Paper, a practical skills exam, and a written care study. Some pathways — commonly NAC/NAP — often do <strong>not</strong> include the written care study.</p>
          <div className="exam-chips">
            <div className="exam-chip">
              <div className="exam-num">1</div>
              <div className="exam-chip-body"><h4>Part 1 — Core MCQs (programme paper)</h4><p>Typically 180 MCQs · 3 hours</p></div>
            </div>
            <div className="exam-chip">
              <div className="exam-num">2</div>
              <div className="exam-chip-body"><h4>Part 2 — Core MCQs (programme paper)</h4><p>Typically 180 MCQs · 3 hours</p></div>
            </div>
            <div className="exam-chip">
              <div className="exam-num">3</div>
              <div className="exam-chip-body"><h4>Part 3 — General Paper (shared MCQs, all programmes)</h4><p>Typically 100 MCQs · 1 hr 30 min</p></div>
            </div>
            <div className="exam-chip">
              <div className="exam-num">4</div>
              <div className="exam-chip-body"><h4>Part 4 — Practical Exam (skills &amp; competence)</h4><p>Stations / procedures · technique + safety</p></div>
            </div>
            <div className="exam-chip">
              <div className="exam-num">5</div>
              <div className="exam-chip-body">
                <h4>Part 5 — Care Study / Care Plan (written clinical application)</h4>
                <p>Completed during clinical posting <span className="exam-warn">Exception: often not required for NAC/NAP</span></p>
              </div>
            </div>
          </div>
          <p className="exam-note">Exact practical stations and care study deadlines are set during clinical posting and communicated by your school or the NMC.</p>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section features-section">
        <div className="section-inner">
          <p className="kicker">What you get</p>
          <h2 className="section-h">Everything you need to pass your NMC exam</h2>
          <div className="features-grid">
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M7 10h6M7 7h4" /></svg>
              </div>
              <div>
                <h4>Practice quizzes &amp; quiz builder</h4>
                <p>Custom quiz builder lets you target specific topics and concepts, up to 50 questions per session. Fixed quizzes also available.</p>
              </div>
            </div>
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7" /><path d="M10 7v3l2.5 2.5" /></svg>
              </div>
              <div>
                <h4>Timed exam simulation</h4>
                <p>Two modes: instant practice with immediate feedback, or timed mode to simulate real exam conditions and build speed.</p>
              </div>
            </div>
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17V7l7-4 7 4v10" /><path d="M8 17v-6h4v6" /></svg>
              </div>
              <div>
                <h4>Learning history &amp; tracking</h4>
                <p>Full attempt log with scores, time, and answer reviews. Resume sessions, retake quizzes, and see exactly where you need work.</p>
              </div>
            </div>
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l2 2 4-4" /><rect x="3" y="5" width="14" height="12" rx="2" /><path d="M7 5V3h6v2" /></svg>
              </div>
              <div>
                <h4>Detailed question rationales</h4>
                <p>Every question includes a full explanation and per-option reasoning — so each attempt is a learning opportunity, not just a score.</p>
              </div>
            </div>
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8z" /><polyline points="12 2 12 8 18 8" /><line x1="8" y1="13" x2="12" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg>
              </div>
              <div>
                <h4>Offline PDF packs</h4>
                <p>Download question packs to study anywhere — even when you don&apos;t have internet access. Available to subscribers.</p>
              </div>
            </div>
            <div className="feat-card">
              <div className="feat-icon">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L3 6v4c0 4.1 3 7.9 7 9 4-1.1 7-4.9 7-9V6l-7-4z" /></svg>
              </div>
              <div>
                <h4>Telegram study community</h4>
                <p>Subscribe and get access to a dedicated Telegram group for your programme — study tips, discussions, and peer support.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section how-section">
        <div className="section-inner">
          <p className="kicker">How it works</p>
          <h2 className="section-h">Studying on Quademia in 4 steps</h2>
          <p className="section-sub">Simple by design. Get to practising in minutes.</p>
          <div className="steps">
            <div className="step">
              <div className="step-n">1</div>
              <h4>Register free</h4>
              <p>Create your account, select your NMC programme, and get instant trial access — no card required.</p>
            </div>
            <div className="step">
              <div className="step-n">2</div>
              <h4>Choose a quiz</h4>
              <p>Pick a fixed quiz, build a custom one, or go for a timed mock exam. Your content is tailored to your programme.</p>
            </div>
            <div className="step">
              <div className="step-n">3</div>
              <h4>Learn from every answer</h4>
              <p>After each question, read the rationale — understand why an answer is right, not just that it is.</p>
            </div>
            <div className="step">
              <div className="step-n">4</div>
              <h4>Track and improve</h4>
              <p>Your history shows every attempt. Review weak areas, retake targeted quizzes, and watch your scores climb.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <div className="cta-band">
        <h2>Ready to start preparing?</h2>
        <p>Join hundreds of nursing students across Ghana already using Quademia for their NMC exam prep.</p>
        <div className="cta-row-c">
          <a href="/register" className="btn-hero-p">Create Your Free Account</a>
          <a href="/subscribe" className="btn-hero-g">View Subscription Plans</a>
        </div>
        <p className="cta-sub">Already registered? <a href="/subscribe">Subscribe to paid access →</a></p>
      </div>

      {/* FOOTER — shared, and its year is computed rather than typed */}
      <PublicFooter />
    </div>
  );
}
