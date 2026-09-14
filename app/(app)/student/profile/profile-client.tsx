// app/(app)/student/profile/profile-client.tsx
//
// The script block of legacy student/profile.html (slice 7e): the
// Personal Details panel (the photo or the initials, the name and
// "Student", the four rows; the pencil opens edit mode with "Change
// photo"; Save uploads the picked photo, requires a first name, writes
// the names, the joined name, the phone and the photo address; Cancel
// restores), the Academic Details panel (Programme read-only; the
// region-grouped school picker with "My school isn't listed" and its
// text box; Level; Cohort), the Subscription panel (read-only), and
// the `?complete=1` arrival (the panel with the missing phone or school
// opens in edit mode, the field highlighted, scrolled to). The page's
// own bottom-right toast is the shared top-right one (UI convention #1),
// its title folded into the message.
//
// After a save the local values follow, as legacy's did, and the route
// is refreshed so the sidebar's photo and name follow too.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/lib/toast/toast';
import { saveAcademicDetails, savePersonalDetails } from '@/lib/profile/actions';
import { PROFILE_IMAGE_MAX_BYTES, PROFILE_LEVELS, type ProfileSubscription, type SchoolOption } from '@/lib/profile/types';

type ProfileFields = {
  forename: string | null;
  surname: string | null;
  name: string | null;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  program_id: string | null;
  level: string | null;
  cohort: string | null;
  school_id: number | null;
  school_other: string | null;
};

type Msg = { text: string; tone: 'error' | 'success' } | null;

function initialsOf(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function isSafeUrl(url: string | null): url is string {
  return !!url && (/^https?:\/\//.test(url) || url.startsWith('data:image/'));
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function ProfileClient({
  profile,
  programName,
  schools,
  subscription,
  complete,
}: {
  profile: ProfileFields;
  programName: string | null;
  schools: SchoolOption[];
  subscription: ProfileSubscription | null;
  complete: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const dismiss = useCallback(() => setMsg(null), []);

  // the saved values (legacy fullUser), updated after each save
  const [user, setUser] = useState<ProfileFields>(profile);

  // ── Personal panel ──
  const [personalEditing, setPersonalEditing] = useState(false);
  const [forename, setForename] = useState(profile.forename || '');
  const [surname, setSurname] = useState(profile.surname || '');
  const [phone, setPhone] = useState(profile.phone_number || '');
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [personalSaving, setPersonalSaving] = useState(false);
  const [phoneNeeds, setPhoneNeeds] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Academic panel ──
  const [academicEditing, setAcademicEditing] = useState(false);
  const [level, setLevel] = useState(profile.level || '');
  const [cohort, setCohort] = useState(profile.cohort || '');
  const [school, setSchool] = useState(profile.school_id ? String(profile.school_id) : profile.school_other ? '__OTHER__' : '');
  const [schoolOther, setSchoolOther] = useState(profile.school_other || '');
  const [academicSaving, setAcademicSaving] = useState(false);
  const [schoolNeeds, setSchoolNeeds] = useState(false);

  const personalRef = useRef<HTMLDivElement | null>(null);
  const academicRef = useRef<HTMLDivElement | null>(null);

  // legacy boot: arriving from the dashboard nudge
  useEffect(() => {
    if (!complete) return;
    const phoneEmpty = !(profile.phone_number && String(profile.phone_number).trim());
    const schoolEmpty = !(profile.school_id || (profile.school_other && String(profile.school_other).trim()));
    const id = window.setTimeout(() => {
      if (phoneEmpty) {
        setPersonalEditing(true);
        setPhoneNeeds(true);
      }
      if (schoolEmpty) {
        setAcademicEditing(true);
        setSchoolNeeds(true);
      }
      (phoneEmpty ? personalRef : academicRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(id);
  }, [complete, profile.phone_number, profile.school_id, profile.school_other]);

  // legacy renderPersonal / renderAcademic on cancel
  function cancelPersonal() {
    setPersonalEditing(false);
    setPendingPhoto(null);
    setPhotoPreview(null);
    setForename(user.forename || '');
    setSurname(user.surname || '');
    setPhone(user.phone_number || '');
  }

  function cancelAcademic() {
    setAcademicEditing(false);
    setLevel(user.level || '');
    setCohort(user.cohort || '');
    setSchool(user.school_id ? String(user.school_id) : user.school_other ? '__OTHER__' : '');
    setSchoolOther(user.school_other || '');
  }

  // legacy onAvatarSelected
  function onPhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setMsg({ text: 'Too large: Image must be under 2 MB.', tone: 'error' });
      return;
    }
    setPendingPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  // legacy savePersonal
  async function savePersonal() {
    setPersonalSaving(true);
    try {
      let photo: FormData | null = null;
      if (pendingPhoto) {
        photo = new FormData();
        photo.append('photo', pendingPhoto);
      }
      const result = await savePersonalDetails({ forename, surname, phone_number: phone }, photo);
      if (!result.ok) {
        setMsg({ text: result.error, tone: 'error' });
        return;
      }
      const f = forename.trim();
      const s = surname.trim();
      setUser((u) => ({ ...u, forename: f, surname: s, name: `${f} ${s}`.trim(), phone_number: phone.trim(), avatar_url: result.avatar_url }));
      setPendingPhoto(null);
      setPhotoPreview(null);
      setPersonalEditing(false);
      setPhoneNeeds(false);
      setMsg({ text: 'Personal details updated.', tone: 'success' });
      router.refresh();
    } finally {
      setPersonalSaving(false);
    }
  }

  // legacy saveAcademic
  async function saveAcademic() {
    setAcademicSaving(true);
    try {
      if (school === '__OTHER__' && !schoolOther.trim()) {
        setMsg({ text: "Please type your school's name.", tone: 'error' });
        return;
      }
      const result = await saveAcademicDetails({ level, cohort, school, school_other: schoolOther });
      if (!result.ok) {
        setMsg({ text: result.error, tone: 'error' });
        return;
      }
      setUser((u) => ({
        ...u,
        level,
        cohort: cohort.trim(),
        school_id: school === '__OTHER__' ? null : school ? Number(school) : null,
        school_other: school === '__OTHER__' ? schoolOther.trim() : null,
      }));
      setAcademicEditing(false);
      setSchoolNeeds(false);
      setMsg({ text: 'Academic details updated.', tone: 'success' });
      router.refresh();
    } finally {
      setAcademicSaving(false);
    }
  }

  const displayName = `${user.forename || ''} ${user.surname || ''}`.trim() || user.name || '—';
  const avatarSrc = photoPreview || user.avatar_url;
  const schoolRow = schools.find((s) => String(s.id) === String(user.school_id));
  const schoolLabel = schoolRow ? schoolRow.name : user.school_other || '—';

  // legacy populateSchoolPicker: grouped by region in the order they arrive
  const regions: { region: string; items: SchoolOption[] }[] = [];
  for (const s of schools) {
    const last = regions[regions.length - 1];
    if (last && last.region === s.region) last.items.push(s);
    else regions.push({ region: s.region, items: [s] });
  }

  const subStatusClass = subscription
    ? subscription.status === 'ACTIVE' ? 'badge-ok' : subscription.status === 'EXPIRED' ? 'badge-danger' : 'badge-warn'
    : 'badge-muted';

  return (
    <div className="spf">
      <Toast message={msg?.text ?? null} tone={msg?.tone} onDismiss={dismiss} />
      <div className="profile-container">
        <div className="page-header">
          <h1>My Profile</h1>
          <p>Your NMC Licensure account details</p>
        </div>

        {/* Personal Details */}
        <div className={`panel${personalEditing ? ' editing' : ''}`} ref={personalRef}>
          <div className="panel-head">
            <h2>Personal Details</h2>
            <span className="edit-btn" title="Edit" onClick={() => setPersonalEditing(true)}>✎</span>
          </div>
          <div className="panel-body">
            <div className={`avatar-wrap${personalEditing ? ' editing' : ''}`}>
              <div>
                {isSafeUrl(avatarSrc) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the student's own upload or a preview data: URL
                  <img className="avatar-img" src={avatarSrc} alt={photoPreview ? 'Preview' : 'Profile'} />
                ) : (
                  <div className="avatar-initials">{initialsOf(displayName)}</div>
                )}
              </div>
              <div className="avatar-info">
                <div className="avatar-name">{displayName}</div>
                <div className="avatar-role">Student</div>
              </div>
              <div className="avatar-upload">
                <label htmlFor="avatarInput">Change photo</label>
                <input ref={fileRef} type="file" id="avatarInput" accept="image/jpeg,image/png,image/webp" onChange={onPhotoSelected} />
              </div>
            </div>

            <div className="profile-row">
              <div className="profile-label">First Name</div>
              <div className="profile-value">{user.forename || '—'}</div>
              <div className="profile-input"><input type="text" value={forename} onChange={(e) => setForename(e.target.value)} /></div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Last Name</div>
              <div className="profile-value">{user.surname || '—'}</div>
              <div className="profile-input"><input type="text" value={surname} onChange={(e) => setSurname(e.target.value)} /></div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Email</div>
              <div className="profile-value">{user.email || '—'}</div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Phone</div>
              <div className="profile-value">{user.phone_number || '—'}</div>
              <div className="profile-input"><input type="tel" className={phoneNeeds ? 'needs-input' : ''} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            </div>
          </div>
          <div className="save-bar">
            <button type="button" className="btn" onClick={cancelPersonal}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={personalSaving} onClick={savePersonal}>{personalSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>

        {/* Academic Details */}
        <div className={`panel${academicEditing ? ' editing' : ''}`} ref={academicRef}>
          <div className="panel-head">
            <h2>Academic Details</h2>
            <span className="edit-btn" title="Edit" onClick={() => setAcademicEditing(true)}>✎</span>
          </div>
          <div className="panel-body">
            <div className="profile-row">
              <div className="profile-label">Programme</div>
              <div className="profile-value">{programName || user.program_id || '—'}</div>
            </div>
            <div className="profile-row">
              <div className="profile-label">School</div>
              <div className="profile-value">{schoolLabel}</div>
              <div className="profile-input school-input">
                <select
                  className={schoolNeeds ? 'needs-input' : ''}
                  value={school}
                  onChange={(e) => { setSchool(e.target.value); if (e.target.value !== '__OTHER__') setSchoolOther(''); }}
                >
                  {!schools.length ? <option value="">Could not load schools</option> : <option value="">— Select —</option>}
                  {regions.map((r) => (
                    <optgroup key={r.region} label={r.region}>
                      {r.items.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                    </optgroup>
                  ))}
                  {schools.length ? <option value="__OTHER__">My school isn&apos;t listed</option> : null}
                </select>
                {school === '__OTHER__' ? (
                  <input type="text" className="school-other" placeholder="Type your school's name" value={schoolOther} onChange={(e) => setSchoolOther(e.target.value)} />
                ) : null}
              </div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Level</div>
              <div className="profile-value">{user.level || '—'}</div>
              <div className="profile-input">
                <select value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="">— Select —</option>
                  {PROFILE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Cohort</div>
              <div className="profile-value">{user.cohort || '—'}</div>
              <div className="profile-input"><input type="text" placeholder="e.g. 2024" value={cohort} onChange={(e) => setCohort(e.target.value)} /></div>
            </div>
          </div>
          <div className="save-bar">
            <button type="button" className="btn" onClick={cancelAcademic}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={academicSaving} onClick={saveAcademic}>{academicSaving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </div>

        {/* Subscription */}
        <div className="panel">
          <div className="panel-head">
            <h2>Subscription</h2>
          </div>
          <div className="panel-body">
            <div className="profile-row">
              <div className="profile-label">Status</div>
              <div className="profile-value"><span className={`badge ${subStatusClass}`}>{subscription ? subscription.status : 'None'}</span></div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Plan</div>
              <div className="profile-value">{subscription ? subscription.products?.name || subscription.product_id || '—' : '—'}</div>
            </div>
            <div className="profile-row">
              <div className="profile-label">Expires</div>
              <div className="profile-value">{subscription ? fmtDate(subscription.expires_utc) : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
