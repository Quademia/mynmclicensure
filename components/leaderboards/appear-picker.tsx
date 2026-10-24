// components/leaderboards/appear-picker.tsx
//
// How you'll appear (05 G1b; Sam, 2026-10-20 drawn, 2026-10-24: 2A) — both
// ways on one screen: the username card, chosen already, with an animal
// and a word filled in, the word spun in place up to 3 times and Change
// animal a panel from below; or "Ama O." with the profile photo (the
// animal when there is no photo). Done joins; the database checks the
// word and the animal against its lists and makes the name unique ("Brave
// Lion 2"). The spins are made here from the lists the page carries, so a
// tap never waits on the network. On the way to the challenge today;
// Profile uses it too when its switch is built.
//
// The animal panel is this screen's own piece (not the shared dialog,
// which opens in the middle): the browser's <dialog>, opened with
// showModal() for its focus trap, Escape and inert page, portalled to
// <body>, drawn as a panel from the bottom. The look is in
// styles/leaderboards.css.

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/shell/icons';
import { BodyPortal } from '@/lib/overlays/shared/body-portal';
import { WORD_SPINS, type JoinChoices, type ShownAs } from '@/lib/leaderboards/types';
import { AnimalAvatar } from './animal-avatar';

function otherWord(words: string[], current: string): string {
  if (words.length < 2) return current;
  let next = current;
  while (next === current) next = words[Math.floor(Math.random() * words.length)];
  return next;
}

export function AppearPicker({
  choices,
  pending,
  joining,
  onDone,
  onCancel,
}: {
  choices: JoinChoices;
  /** A save is going (Done's or Cancel's): every button waits. */
  pending: boolean;
  /** Done's save — the button says "Joining…". */
  joining: boolean;
  onDone: (shownAs: ShownAs, word: string, animal: string) => void;
  onCancel: () => void;
}) {
  const [shownAs, setShownAs] = useState<ShownAs>('username');
  const [word, setWord] = useState(choices.first.word);
  const [animal, setAnimal] = useState(choices.first.animal);
  const [spinsLeft, setSpinsLeft] = useState(WORD_SPINS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const group = useId();

  function spin() {
    if (spinsLeft <= 0) return;
    setShownAs('username');
    setWord(otherWord(choices.words, word));
    setSpinsLeft(spinsLeft - 1);
  }

  return (
    <div className="preflight-card lb-appear">
      <div className="preflight-logo">Quademia Nurses Hub</div>
      <div className="preflight-title">How you&apos;ll appear</div>

      <div className="lb-options" role="radiogroup" aria-label="How you'll appear">
        <div className={`lb-option${shownAs === 'username' ? ' is-on' : ''}`}>
          <label className="lb-option-pick">
            <AnimalAvatar animal={animal} size={48} />
            <span className="lb-option-main">
              <span className="lb-option-name">
                {word} {animal}
              </span>
              <span className="lb-option-note">A username and an animal</span>
            </span>
            <input type="radio" name={group} checked={shownAs === 'username'} onChange={() => setShownAs('username')} />
          </label>
          <div className="lb-option-tools">
            <button type="button" className="btn-link" onClick={spin} disabled={spinsLeft <= 0 || pending}>
              <Icon name="refresh" />
              {spinsLeft > 0 ? `New word · ${spinsLeft}` : 'No more new words'}
            </button>
            <button
              type="button"
              className="btn-link"
              disabled={pending}
              onClick={() => {
                setShownAs('username');
                setSheetOpen(true);
              }}
            >
              Change animal
            </button>
          </div>
        </div>

        {choices.person ? (
          <div className={`lb-option${shownAs === 'name' ? ' is-on' : ''}`}>
            <label className="lb-option-pick">
              <AnimalAvatar animal={animal} photo={choices.photo} size={48} />
              <span className="lb-option-main">
                <span className="lb-option-name">{choices.person}</span>
                <span className="lb-option-note">
                  {choices.photo ? 'Your first name and photo' : 'Your first name, with your animal (no photo yet)'}
                </span>
              </span>
              <input type="radio" name={group} checked={shownAs === 'name'} onChange={() => setShownAs('name')} />
            </label>
          </div>
        ) : null}
      </div>

      <p className="lb-appear-note">Never your full name. You can change this on Profile.</p>

      <div className="preflight-actions">
        <button type="button" className="btn btn-primary btn-lg" disabled={pending} onClick={() => onDone(shownAs, word, animal)}>
          {joining ? 'Joining…' : 'Done'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>

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
    </div>
  );
}

// Change animal: a panel from below with the 38 drawings, the chosen one
// marked; a tap picks and closes. Escape, the backdrop and ✕ close it.
function AnimalSheet({
  open,
  animals,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  animals: string[];
  current: string;
  onPick: (animal: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const attach = useCallback((el: HTMLDialogElement | null) => {
    ref.current = el;
    if (el && !el.open) el.showModal();
  }, []);

  if (!open) return null;

  return (
    <BodyPortal>
      <dialog
        ref={attach}
        className="lb-sheet"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          // caught on the way down (AGENTS.md: Chrome's cancel needs a user gesture)
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
        onClose={onClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="lb-sheet-body">
          <div className="lb-sheet-head">
            <h2 className="lb-sheet-title" id={titleId}>
              Choose an animal
            </h2>
            <button type="button" className="lb-sheet-close" aria-label="Close" onClick={onClose}>
              <Icon name="x" />
            </button>
          </div>
          <ul className="lb-animal-grid">
            {animals.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  className={`lb-animal-pick${a === current ? ' is-on' : ''}`}
                  aria-pressed={a === current}
                  onClick={() => onPick(a)}
                >
                  <AnimalAvatar animal={a} size={48} lazy />
                  <span>{a}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </BodyPortal>
  );
}
