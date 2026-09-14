// app/(app)/student/portal-guide/portal-guide-client.tsx
//
// The body and script block of legacy student/portal-guide.html (slice
// 7b): the hero, the eleven sections in their order with their words,
// the FAQ accordion (one open at a time, "+" / "–"), the footer with
// Upgrade Access and Message Support, and the "On this page" list —
// built from the sections, highlighting the one most in view
// (IntersectionObserver, legacy's thresholds), scrolling smoothly on
// click; on a phone the list is a "Tap to open" panel above the content
// that closes on pick. "QAcademy" in the hero became Quademia (UI
// convention #5); nothing else changed. The two footer links land on
// the upgrade page (7c) and the messages page (slice 12) and 404 until
// those exist, as the sidebar's own links do.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Section = { id: string; label: string };

const SECTIONS: Section[] = [
  { id: 'sec-dashboard', label: 'Dashboard' },
  { id: 'sec-fixed-quizzes', label: 'Fixed Quizzes' },
  { id: 'sec-quiz-builder', label: 'Quiz Builder' },
  { id: 'sec-modes', label: 'Instant vs Timed' },
  { id: 'sec-after-quiz', label: 'After Your Quiz' },
  { id: 'sec-learning-history', label: 'Learning History' },
  { id: 'sec-downloads', label: 'Offline Packs' },
  { id: 'sec-messages', label: 'Messages' },
  { id: 'sec-telegram', label: 'Telegram' },
  { id: 'sec-payments', label: 'Payments' },
  { id: 'sec-faqs', label: 'FAQs' },
];

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Why does it say "Access blocked"?',
    a: 'This usually means your subscription is expired or the course is not included in your current product. Confirm your access status on the Dashboard, then message support if it still looks incorrect.',
  },
  {
    q: 'I paid — why is my course still locked?',
    a: 'Access should activate automatically. If it does not, keep your Paystack reference and use the verify/success flow if available. You can also message support and include the Paystack reference for faster resolution.',
  },
  {
    q: "Quiz won't load — what should I do?",
    a: 'Refresh the page, confirm your internet connection, and sign in again if needed. If the issue persists, try a different browser tab and then message support with the course and mode (Instant/Timed).',
  },
  {
    q: "What's the difference between Fixed Quizzes and Quiz Builder?",
    a: 'Fixed Quizzes are ready-made sets you can start immediately. Quiz Builder creates custom practice based on your selected topics and difficulty — best for targeting weak areas.',
  },
  {
    q: 'How do I use Learning History properly?',
    a: 'After each session, check your recent attempts, identify 1–2 weak topics, then build a targeted Quiz Builder session. Track improvement over time by revisiting the same topics weekly.',
  },
  {
    q: 'Where do I find my Offline Packs again?',
    a: (
      <>
        Go to <strong>My Downloads</strong>. Your packs remain available for re-access, so you can open them again without regenerating.
      </>
    ),
  },
  {
    q: 'Why did my timed quiz submit automatically?',
    a: 'Timed Mode auto-submits when the timer ends. This is normal and matches exam-style practice. Review your results and explanations after submission.',
  },
  {
    q: 'Telegram linking or join issues — what should I check?',
    a: 'Confirm your subscription is active, then link Telegram again if needed. If it still fails, message support with your Telegram username.',
  },
  {
    q: 'I forgot my password — what next?',
    a: 'Use the password reset/forgot password flow on the login page. If you cannot regain access, message support with your account email (avoid sharing sensitive details).',
  },
];

export function PortalGuide() {
  const [active, setActive] = useState<string>('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // legacy initScrollSpy — the section most in view is the active one
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('.guide-section[data-section]'));
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible && visible.target.id) setActive(visible.target.id);
      },
      { root: null, threshold: [0.2, 0.4, 0.6] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // legacy initNavClicks — smooth scroll
  function jumpTo(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // legacy toggleFaq — close all, open the one pressed unless it was open
  function toggleFaq(i: number) {
    setOpenFaq((cur) => (cur === i ? null : i));
  }

  return (
    <div className="spg">
      {/* Mobile nav toggle */}
      <div className={`guide-nav-mobile ${mobileOpen ? 'open' : ''}`}>
        <button type="button" className="guide-nav-mobile-btn" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen}>
          <span>On this page</span>
          <span className="hint">Tap to open</span>
        </button>
        <div className="guide-nav-mobile-panel">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => { jumpTo(e, s.id); setMobileOpen(false); }}>{s.label}</a>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="guide-hero">
        <h1>Portal Guide</h1>
        <p>Use this guide to navigate Quademia confidently — practice, review, track progress, and improve consistently.</p>
      </div>

      <div className="guide-layout">
        {/* Main content */}
        <div className="guide-content" ref={contentRef}>

          {/* Dashboard */}
          <div className="guide-section" id="sec-dashboard" data-section="Dashboard">
            <h2>Dashboard (Your home page)</h2>
            <p className="lead">Your Dashboard helps you find everything quickly — active courses, practice tools, and your account status.</p>
            <div className="guide-inner-card">
              <h3>Use the Dashboard to:</h3>
              <ul>
                <li>See your active courses and access status</li>
                <li>Jump into Fixed Quizzes, Quiz Builder, Learning History, Downloads, and Messages</li>
                <li>Continue your study routine without searching for links</li>
              </ul>
            </div>
          </div>

          {/* Fixed Quizzes */}
          <div className="guide-section" id="sec-fixed-quizzes" data-section="Fixed Quizzes">
            <h2>Fixed Quizzes (Ready-made practice)</h2>
            <p className="lead">Fixed Quizzes are prepared sets you can start immediately — no topic selection required.</p>
            <div className="guide-grid">
              <div className="guide-inner-card">
                <h3>Recommended for</h3>
                <ul>
                  <li>Daily practice</li>
                  <li>Fast revision before exams</li>
                  <li>Quick mock sessions</li>
                </ul>
              </div>
              <div className="guide-inner-card">
                <h3>How to use it well</h3>
                <p>Start a set, finish it, then review your explanations carefully. Use Learning History to identify repeated weak areas.</p>
                <div className="guide-tip"><strong>Tip:</strong> If you keep missing the same topic, switch to Quiz Builder and focus on that area.</div>
              </div>
            </div>
          </div>

          {/* Quiz Builder */}
          <div className="guide-section" id="sec-quiz-builder" data-section="Quiz Builder">
            <h2>Quiz Builder (Custom practice)</h2>
            <p className="lead">Quiz Builder lets you create targeted practice by choosing course, topics, difficulty, number of questions, and mode.</p>
            <div className="guide-grid">
              <div className="guide-inner-card">
                <h3>What you choose</h3>
                <ul>
                  <li>Course</li>
                  <li>Topics</li>
                  <li>Difficulty</li>
                  <li>Number of questions</li>
                  <li>Mode (Instant or Timed)</li>
                </ul>
              </div>
              <div className="guide-inner-card">
                <h3>Recommended settings</h3>
                <ul>
                  <li><strong>New topic:</strong> 10–20 questions, Instant</li>
                  <li><strong>Revision:</strong> 25–50 questions, mixed difficulty</li>
                  <li><strong>Mock exam:</strong> 50–100 questions, Timed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Instant vs Timed */}
          <div className="guide-section" id="sec-modes" data-section="Instant vs Timed">
            <h2>Instant vs Timed (Choose the right mode)</h2>
            <p className="lead">Both modes are valuable. Use Instant for learning and Timed for exam readiness.</p>
            <div className="guide-grid">
              <div className="guide-inner-card">
                <h3>Instant Mode</h3>
                <p>Feedback shows as you answer. Best for learning, understanding concepts, and improving quickly.</p>
              </div>
              <div className="guide-inner-card">
                <h3>Timed Mode</h3>
                <p>Exam-style practice. Best for speed, accuracy, and confidence under pressure.</p>
              </div>
            </div>
          </div>

          {/* After Your Quiz */}
          <div className="guide-section" id="sec-after-quiz" data-section="After Your Quiz">
            <h2>After your quiz (Improve faster)</h2>
            <p className="lead">Your improvement comes from the review process, not only from answering questions.</p>
            <div className="guide-inner-card">
              <ul>
                <li>Review explanations carefully — focus on <em>why</em> an option is correct</li>
                <li>Identify repeated weak areas</li>
                <li>Build your next session around weak topics (Quiz Builder) or repeat a similar Fixed Quiz</li>
              </ul>
            </div>
          </div>

          {/* Learning History */}
          <div className="guide-section" id="sec-learning-history" data-section="Learning History">
            <h2>Learning History (Track your progress)</h2>
            <p className="lead">Learning History helps you review past attempts, identify weak topics, and monitor improvement over time.</p>
            <div className="guide-grid">
              <div className="guide-inner-card">
                <h3>What it helps you do</h3>
                <ul>
                  <li>Review your past attempts and scores</li>
                  <li>Identify topics you repeatedly miss</li>
                  <li>Monitor improvement over time</li>
                </ul>
              </div>
              <div className="guide-inner-card">
                <h3>Best practice</h3>
                <p>After each session, select 1–2 weak topics from Learning History and practice them in Quiz Builder.</p>
              </div>
            </div>
          </div>

          {/* Offline Packs */}
          <div className="guide-section" id="sec-downloads" data-section="Offline Packs">
            <h2>My Downloads (Offline Packs)</h2>
            <p className="lead">Offline packs help you study without internet and re-open your materials anytime.</p>
            <div className="guide-inner-card">
              <ul>
                <li>Generate a pack from your course/topics</li>
                <li>Find it later inside <strong>My Downloads</strong></li>
                <li>Re-open packs without needing to regenerate</li>
              </ul>
              <div className="guide-tip"><strong>Note:</strong> Download limits may apply depending on your subscription.</div>
            </div>
          </div>

          {/* Messages */}
          <div className="guide-section" id="sec-messages" data-section="Messages">
            <h2>Messages (Support and tutors)</h2>
            <p className="lead">Use Messages to get help quickly — general support, course support, or question-specific support.</p>
            <div className="guide-grid">
              <div className="guide-inner-card">
                <h3>When to message</h3>
                <ul>
                  <li><strong>General support:</strong> account or access questions</li>
                  <li><strong>Course support:</strong> help with a course topic</li>
                  <li><strong>Question support:</strong> &quot;Message about this question&quot; inside a quiz</li>
                </ul>
              </div>
              <div className="guide-inner-card">
                <h3>To get faster help</h3>
                <p>Include the topic, what confused you, and a short screenshot if needed. Avoid sharing personal details.</p>
              </div>
            </div>
          </div>

          {/* Telegram */}
          <div className="guide-section" id="sec-telegram" data-section="Telegram">
            <h2>Telegram Support (Premium)</h2>
            <p className="lead">Premium members can access Telegram support groups for updates, guidance, and support.</p>
            <div className="guide-inner-card">
              <ol>
                <li>Link your Telegram account (one time)</li>
                <li>Join your assigned groups</li>
                <li>Use the groups for updates and support</li>
              </ol>
              <div className="guide-tip"><strong>If you cannot join:</strong> confirm your subscription is active, then message support with your Telegram username.</div>
            </div>
          </div>

          {/* Payments */}
          <div className="guide-section" id="sec-payments" data-section="Payments">
            <h2>Payments &amp; Access</h2>
            <p className="lead">After payment, access should activate automatically and your Dashboard will show active courses.</p>
            <div className="guide-inner-card">
              <h3>If you paid but access is still locked</h3>
              <ul>
                <li>Keep your <strong>Paystack reference</strong></li>
                <li>Use the verify/success flow (if available)</li>
                <li>Or message support and include the Paystack reference</li>
              </ul>
            </div>
          </div>

          {/* FAQs */}
          <div className="guide-section" id="sec-faqs" data-section="FAQs">
            <h2>FAQs (Quick fixes)</h2>
            <p className="lead">Common issues and the fastest solutions.</p>
            <div className="faq-list">
              {FAQS.map((f, i) => {
                const open = openFaq === i;
                return (
                  <div key={f.q} className={`faq-item ${open ? 'open' : ''}`}>
                    <button type="button" className="faq-btn" onClick={() => toggleFaq(i)} aria-expanded={open}>
                      {f.q}
                      <span className="faq-icon">{open ? '–' : '+'}</span>
                    </button>
                    <div className="faq-panel">{f.a}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA Footer */}
          <div className="guide-cta">
            <div>
              <h3>Ready to upgrade your prep?</h3>
              <p>Get full access and premium support for your 2026 licensure preparation.</p>
            </div>
            <div className="guide-cta-actions">
              <Link href="/student/upgrade" className="btn btn-primary">Upgrade Access</Link>
              <Link href="/student/messages" className="btn btn-secondary">Message Support</Link>
            </div>
          </div>

        </div>

        {/* Right-side sticky nav */}
        <aside className="guide-nav">
          <div className="guide-nav-title">On this page</div>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? 'active' : ''} onClick={(e) => jumpTo(e, s.id)}>
              <span className="guide-nav-dot" />
              {s.label}
            </a>
          ))}
        </aside>
      </div>
    </div>
  );
}
