// lib/announcements/kind-actions.ts
//
// The admin's kinds (08.13; Sam, 2026-10-18: "the examples given may not
// be enough"), behind the admin gate, with the service role (the browser
// holds nothing on announcement_kinds). Add a kind with a name and an icon
// from the grid; rename it or pick another icon (a rename reaches every
// notice inside the database: the key is the name, on update cascade);
// move it up or down the list; retire it — no longer offered for a new
// notice, kept by the notices that use it — or bring it back. Nothing
// deletes a kind. The database refuses a second kind of the same name
// whatever its case.

'use server';

import { requireAdmin } from '@/lib/access';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isKindIcon } from './display';
import { KIND_NAME_MAX, type ActionResult } from './types';

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function cleanName(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function nameProblem(name: string): string | null {
  if (!name) return 'Give the kind a name.';
  if (name.length > KIND_NAME_MAX) return `A kind's name is at most ${KIND_NAME_MAX} characters.`;
  return null;
}

function duplicate(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export async function addKind(nameIn: string, icon: string): Promise<ActionResult> {
  await requireAdmin();
  const name = cleanName(nameIn);
  const problem = nameProblem(name);
  if (problem) return fail(problem);
  if (!isKindIcon(icon)) return fail('Pick an icon from the grid.');
  const db = createServiceRoleClient();
  const { data: last } = await db.from('announcement_kinds').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
  const position = ((last as { position: number } | null)?.position ?? 0) + 1;
  const { error } = await db.from('announcement_kinds').insert({ name, icon, position });
  if (duplicate(error)) return fail('There is already a kind with that name.');
  if (error) return fail('The kind could not be added. Please try again.');
  return { ok: true };
}

export async function updateKind(oldNameIn: string, nameIn: string, icon: string): Promise<ActionResult> {
  await requireAdmin();
  const oldName = cleanName(oldNameIn);
  const name = cleanName(nameIn);
  const problem = nameProblem(name);
  if (problem) return fail(problem);
  if (!isKindIcon(icon)) return fail('Pick an icon from the grid.');
  const { data, error } = await createServiceRoleClient()
    .from('announcement_kinds')
    .update({ name, icon })
    .eq('name', oldName)
    .select('name');
  if (duplicate(error)) return fail('There is already a kind with that name.');
  if (error) return fail('The kind could not be saved. Please try again.');
  if (!data?.length) return fail('That kind is no longer there.');
  return { ok: true };
}

export async function moveKind(nameIn: string, direction: 'up' | 'down'): Promise<ActionResult> {
  await requireAdmin();
  const name = cleanName(nameIn);
  const db = createServiceRoleClient();
  const { data, error } = await db.from('announcement_kinds').select('name').order('position').order('name');
  if (error || !data) return fail('The order could not be changed. Please try again.');
  const names = (data as { name: string }[]).map((k) => k.name);
  const at = names.indexOf(name);
  const to = direction === 'up' ? at - 1 : at + 1;
  if (at < 0) return fail('That kind is no longer there.');
  if (to < 0 || to >= names.length) return { ok: true };
  [names[at], names[to]] = [names[to], names[at]];
  // the list is short: every kind takes its place 1, 2, 3 …
  const results = await Promise.all(names.map((n, i) => db.from('announcement_kinds').update({ position: i + 1 }).eq('name', n)));
  if (results.some((r) => r.error)) return fail('The order could not be changed. Please try again.');
  return { ok: true };
}

export async function setKindActive(nameIn: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const name = cleanName(nameIn);
  const db = createServiceRoleClient();
  if (!active) {
    const { count } = await db.from('announcement_kinds').select('name', { count: 'exact', head: true }).eq('active', true);
    if ((count ?? 0) <= 1) return fail('Keep at least one kind to choose from.');
  }
  const { data, error } = await db.from('announcement_kinds').update({ active }).eq('name', name).select('name');
  if (error) return fail('The kind could not be changed. Please try again.');
  if (!data?.length) return fail('That kind is no longer there.');
  return { ok: true };
}
