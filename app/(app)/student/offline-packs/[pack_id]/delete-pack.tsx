// app/(app)/student/offline-packs/[pack_id]/delete-pack.tsx — Delete pack
// (07.7; Sam, 2026-10-15): a quiet red link at the foot of the pack's page,
// the app's confirm box saying the allowance is not given back, then back
// to My packs. A failed request — the server's refusal or a dropped
// connection — says so and gives the link back. Single-use, so beside its
// page.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOfflinePack } from '@/lib/offline-packs/actions';
import { useConfirm } from '@/lib/overlays/shared/confirm-dialog';
import { Toast } from '@/lib/toast/toast';

export function DeletePack({ packId }: { packId: string }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = await confirm({
      title: 'Delete this pack?',
      body: "You won't get this pack back in your allowance.",
      confirmLabel: 'Delete pack',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await deleteOfflinePack(packId);
      if (!result.ok) {
        setError(result.message);
        setBusy(false);
        return;
      }
    } catch {
      setError('Could not delete this pack. Please check your connection.');
      setBusy(false);
      return;
    }
    // My packs is read fresh on every visit (force-dynamic); a refresh
    // called here as well cancelled the move and left "Deleting…" showing.
    router.replace('/student/offline-packs');
  }

  return (
    <>
      <button type="button" className="btn-link danger opk-delete" disabled={busy} onClick={() => void onDelete()}>
        {busy ? 'Deleting…' : 'Delete pack'}
      </button>
      {confirmDialog}
      <Toast message={error} tone="error" onDismiss={() => setError(null)} />
    </>
  );
}
