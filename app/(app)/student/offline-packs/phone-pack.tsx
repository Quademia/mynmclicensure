// app/(app)/student/offline-packs/phone-pack.tsx — a pack on this phone
// (07.3; Sam, 2026-10-15, drawn at
// https://claude.ai/artifact/NrEnZUieGVsFmZkZEmjbFm). Client pieces for My
// packs and a pack's page; what they show is read from the phone
// (lib/offline-packs/phone), never from the server.
//
//   - PhoneLine: a row's "On this phone · Last: 14 of 20" (My packs).
//   - PhoneMark: the pack page's "On this phone · Last practice: 14 of 20",
//     above Practise.
//   - PhoneKeep: under the pack page's card — Save to this phone, or
//     Remove from this phone with "It stays in My packs; save it here again
//     any time." The phone a pack was made on keeps it at once (the
//     builder lands here with ?new=1).
//   - PhonePrune: My packs tells the phone which packs are still the
//     student's (a pack deleted elsewhere leaves) and the check-in period.
//
// Each shows nothing until the phone has answered, so a pack never flickers
// from "Save" to "On this phone".

'use client';

import { useEffect, useRef, useState } from 'react';
import { getPackForPhone } from '@/lib/offline-packs/actions';
import { prunePhone, removePhonePack, savePhonePack, usePhonePacks, type PhonePack } from '@/lib/offline-packs/phone';
import { warmOfflineApp } from '@/lib/offline-packs/offline-app';
import { Toast } from '@/lib/toast/toast';

function usePhonePack(packId: string): { ready: boolean; pack: PhonePack | null; unavailable: boolean } {
  const phone = usePhonePacks();
  return {
    ready: phone !== null,
    pack: phone?.packs.find((p) => p.pack_id === packId) ?? null,
    unavailable: Boolean(phone?.unavailable),
  };
}

function lastWords(pack: PhonePack, label: string): string {
  return pack.last ? `${label}: ${pack.last.right} of ${pack.last.total}` : 'Not practised yet';
}

export function PhoneLine({ packId }: { packId: string }) {
  const { pack } = usePhonePack(packId);
  if (!pack) return null;
  return (
    <span className="opk-phone">
      <span className="badge opk-here">On this phone</span>
      <span className="opk-last">{lastWords(pack, 'Last')}</span>
    </span>
  );
}

export function PhoneMark({ packId }: { packId: string }) {
  const { pack } = usePhonePack(packId);
  if (!pack) return null;
  return (
    <span className="opk-phone">
      <span className="badge opk-here">On this phone</span>
      <span className="pp-line">{lastWords(pack, 'Last practice')}</span>
    </span>
  );
}

const NO_SAVE = 'Could not save this pack to this phone. Please check your connection.';

export function PhoneKeep({ packId, autoSave }: { packId: string; autoSave: boolean }) {
  const { ready, pack, unavailable } = usePhonePack(packId);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const autoTried = useRef(false);

  async function save(quiet: boolean) {
    setBusy(true);
    try {
      const load = await getPackForPhone(packId);
      if (!load.ok) {
        setToast({ text: load.message, tone: 'error' });
        return;
      }
      await savePhonePack({ ...load.pack, questions: load.questions }, load.checkinDays);
      void warmOfflineApp(true);
      if (!quiet) setToast({ text: 'Saved to this phone. It opens with no signal.', tone: 'success' });
    } catch {
      setToast({ text: NO_SAVE, tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removePhonePack(packId);
    } catch {
      setToast({ text: 'Could not remove this pack from this phone.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  // The phone it was made on keeps it: once, when the phone has answered
  // and does not hold it yet.
  useEffect(() => {
    if (!autoSave || !ready || unavailable || pack || autoTried.current) return;
    autoTried.current = true;
    const t = setTimeout(() => void save(true), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on the phone's first answer
  }, [autoSave, ready, unavailable, pack]);

  if (!ready) return null;

  return (
    <div className="opk-keep">
      {unavailable ? (
        <span className="pp-line">This browser cannot keep packs. Open My packs in Chrome or Safari on your phone to save them there.</span>
      ) : pack ? (
        <>
          <button type="button" className="btn-link opk-keep-btn" disabled={busy} onClick={() => void remove()}>
            {busy ? 'Removing…' : 'Remove from this phone'}
          </button>
          <span className="pp-line">It stays in My packs; save it here again any time.</span>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-ghost btn-lg opk-save" disabled={busy} onClick={() => void save(false)}>
            {busy ? 'Saving…' : 'Save to this phone'}
          </button>
          <span className="pp-line">Keep it on this phone to practise with no signal.</span>
        </>
      )}
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </div>
  );
}

export function PhonePrune({ userId, activeIds, checkinDays }: { userId: string; activeIds: string[]; checkinDays: number }) {
  const key = activeIds.join(',');
  useEffect(() => {
    void prunePhone(userId, key ? key.split(',') : [], checkinDays).catch(() => {
      // a browser keeping no packs has nothing to prune
    });
  }, [userId, key, checkinDays]);
  return null;
}
