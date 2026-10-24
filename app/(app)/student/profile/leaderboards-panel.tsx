// app/(app)/student/profile/leaderboards-panel.tsx — Profile's Leaderboards
// (05 G1b; Sam, 2026-10-24, drawn: after Academic Details).
//
//   - Show me on the leaderboards: the Notifications panel's switch
//     (device-switch.tsx), no confirm on turning off — it is undone with a
//     tap and keeps the username. Turning on puts a student who held a
//     username straight back; one who never had one chooses How you'll
//     appear here first (the same screen as on the way to the challenge).
//   - How you appear: the two cards; a tap on the other saves it at once.
//   - Change username: once a week (the database refuses sooner; the name
//     chosen at joining is not a change) — the username card made editable,
//     New word up to 3 times and Change animal, Save or Cancel; in the
//     week after a change, the day it may change again.
// Each change is one call to the database's own function (05.7); the card
// that comes back is what the panel shows.

'use client';

import { useState } from 'react';
import { Toast } from '@/lib/toast/toast';
import { AppLink } from '@/components/shell/link-pending';
import { Icon } from '@/components/shell/icons';
import { DeviceSwitch } from '@/components/notifications/device-switch';
import { AnimalAvatar } from '@/components/leaderboards/animal-avatar';
import { AnimalSheet, AppearPicker, otherWord } from '@/components/leaderboards/appear-picker';
import { joinLeaderboards, leaveLeaderboards, renameOnLeaderboards, showAsOnLeaderboards } from '@/lib/leaderboards/actions';
import { LEADERBOARDS_HREF, WORD_SPINS, type CardResult, type JoinChoices, type LeaderboardCard, type ShownAs } from '@/lib/leaderboards/types';
import '@/styles/notifications.css';
import '@/styles/leaderboards.css';

type Msg = { text: string; tone: 'error' | 'success' } | null;

export function LeaderboardsPanel({
  initial,
  choices,
  person,
  photo,
}: {
  initial: LeaderboardCard | null;
  /** The word and animal lists (and a first card for a student with no username). */
  choices: JoinChoices | null;
  /** "Ama O." and the photo, as Personal Details now has them. */
  person: string | null;
  photo: string | null;
}) {
  const [card, setCard] = useState<LeaderboardCard | null>(initial);
  const [mode, setMode] = useState<'view' | 'joining' | 'renaming'>('view');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  // the rename's card
  const [word, setWord] = useState('');
  const [animal, setAnimal] = useState('');
  const [spinsLeft, setSpinsLeft] = useState(WORD_SPINS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const joined = card?.joined === true;
  const hasName = Boolean(card?.word && card?.animal);

  async function run(call: () => Promise<CardResult>, done: string) {
    setBusy(true);
    try {
      const r = await call();
      if (!r.ok) {
        setMsg({ text: r.error, tone: 'error' });
        return false;
      }
      setCard(r.card);
      setMsg({ text: done, tone: 'success' });
      return true;
    } catch {
      setMsg({ text: 'Could not save. Please check your connection and try again.', tone: 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function flip() {
    if (mode === 'joining') {
      setMode('view');
      return;
    }
    if (joined) {
      setMode('view');
      void run(leaveLeaderboards, "You're off the leaderboards. Your username is kept.");
    } else if (hasName && card) {
      void run(() => joinLeaderboards(card.shownAs, card.word ?? '', card.animal ?? ''), "You're on the leaderboards.");
    } else if (choices) {
      setMode('joining');
    }
  }

  function startRename() {
    if (!card?.word || !card.animal) return;
    setWord(card.word);
    setAnimal(card.animal);
    setSpinsLeft(WORD_SPINS);
    setMode('renaming');
  }

  function spin() {
    if (!choices || spinsLeft <= 0) return;
    setWord(otherWord(choices.words, word));
    setSpinsLeft(spinsLeft - 1);
  }

  async function saveRename() {
    if (word === card?.word && animal === card?.animal) {
      setMode('view');
      return;
    }
    if (await run(() => renameOnLeaderboards(word, animal), 'Username changed.')) setMode('view');
  }

  function showAs(s: ShownAs) {
    if (!card || card.shownAs === s || busy) return;
    void run(() => showAsOnLeaderboards(s), 'Saved.');
  }

  let block: React.ReactNode = null;
  if (mode === 'joining' && choices) {
    block = (
      <AppearPicker
        bare
        choices={choices}
        pending={busy}
        joining={busy}
        onDone={(s, w, a) =>
          void run(() => joinLeaderboards(s, w, a), "You're on the leaderboards.").then((ok) => {
            if (ok) setMode('view');
          })
        }
        onCancel={() => setMode('view')}
      />
    );
  } else if (joined && card && mode === 'renaming') {
    block = (
      <>
        <p className="lbf-sub">Change your username</p>
        <div className="lb-option is-on">
          <div className="lb-option-pick">
            <AnimalAvatar animal={animal} size={48} />
            <span className="lb-option-main">
              <span className="lb-option-name">
                {word} {animal}
              </span>
            </span>
          </div>
          <div className="lb-option-tools">
            <button type="button" className="btn-link" onClick={spin} disabled={spinsLeft <= 0 || busy || !choices}>
              <Icon name="refresh" />
              {spinsLeft > 0 ? `New word · ${spinsLeft}` : 'No more new words'}
            </button>
            <button type="button" className="btn-link" disabled={busy || !choices} onClick={() => setSheetOpen(true)}>
              Change animal
            </button>
          </div>
        </div>
        <p className="lb-appear-note">Once a week. Others see the new name at once.</p>
        <div className="lb-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveRename()}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setMode('view')}>
            Cancel
          </button>
        </div>
        {choices ? (
          <AnimalSheet
            open={sheetOpen}
            animals={choices.animals}
            current={animal}
            onPick={(a) => {
              setAnimal(a);
              setSheetOpen(false);
            }}
            onClose={() => setSheetOpen(false)}
          />
        ) : null}
      </>
    );
  } else if (joined && card && card.animal) {
    block = (
      <>
        <p className="lbf-sub">How you appear</p>
        <div className="lb-options" role="radiogroup" aria-label="How you appear">
          <div className={`lb-option${card.shownAs === 'username' ? ' is-on' : ''}`}>
            <label className="lb-option-pick">
              <AnimalAvatar animal={card.animal} size={48} />
              <span className="lb-option-main">
                <span className="lb-option-name">{card.username}</span>
                <span className="lb-option-note">A username and an animal</span>
              </span>
              <input type="radio" name="lbf-shown" checked={card.shownAs === 'username'} disabled={busy} onChange={() => showAs('username')} />
            </label>
            <div className="lb-option-tools">
              {card.renameFrom ? (
                <span className="lbf-wait">You can change it again from {card.renameFrom}</span>
              ) : (
                <button type="button" className="btn-link" disabled={busy || !choices} onClick={startRename}>
                  Change username
                </button>
              )}
            </div>
          </div>
          {person ? (
            <div className={`lb-option${card.shownAs === 'name' ? ' is-on' : ''}`}>
              <label className="lb-option-pick">
                <AnimalAvatar animal={card.animal} photo={photo} size={48} />
                <span className="lb-option-main">
                  <span className="lb-option-name">{person}</span>
                  <span className="lb-option-note">{photo ? 'Your first name and photo' : 'Your first name, with your animal (no photo yet)'}</span>
                </span>
                <input type="radio" name="lbf-shown" checked={card.shownAs === 'name'} disabled={busy} onChange={() => showAs('name')} />
              </label>
            </div>
          ) : null}
        </div>
        <p className="lb-appear-note">
          Never your full name. <AppLink href={LEADERBOARDS_HREF}>See the leaderboards ›</AppLink>
        </p>
      </>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Leaderboards</h2>
      </div>
      <div className="panel-body nset">
        <div className="nset-row">
          <div className="nask-words">
            <p className="nask-title" id="lbf-main">
              Show me on the leaderboards
            </p>
            <p className="nask-sub">
              {joined ? 'Others see you as below.' : 'See where you rank on the daily challenge. Your past challenges count.'}
            </p>
          </div>
          <DeviceSwitch on={joined || mode === 'joining'} busy={busy} labelledBy="lbf-main" onFlip={flip} />
        </div>
        {block ? <div className="nset-row lbf-block">{block}</div> : null}
      </div>
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={() => setMsg(null)} />
    </div>
  );
}
