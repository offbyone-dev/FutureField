import { useState, type ChangeEvent } from 'react';
import { KeyRound, UserRound, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FutureFieldAvatar, { avatarPath, AVATAR_UPDATED } from './FutureFieldAvatar';

type Props = { isDemo: boolean; onSignOut: () => Promise<void> };

export default function SettingsPage({ isDemo, onSignOut }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(() => String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''));
  const [editingName, setEditingName] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.id || isDemo) return;
    resetMessage();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPG, PNG or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setError('Image must be 2 MB or smaller.'); return; }
    setPhotoBusy(true);
    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(avatarPath(user.id), file, { upsert: true, contentType: file.type, cacheControl: '60' });
      if (uploadError) throw uploadError;
      window.dispatchEvent(new Event(AVATAR_UPDATED));
      setNotice('Profile photo updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not upload photo.'); }
    finally { setPhotoBusy(false); }
  };

  const resetMessage = () => { setNotice(''); setError(''); };
  const saveName = async () => {
    resetMessage();
    if (!name.trim()) { setError('Please enter your name.'); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (updateError) throw updateError;
      setEditingName(false);
      setNotice('Profile name updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update name.'); }
    finally { setBusy(false); }
  };

  const savePassword = async () => {
    resetMessage();
    if (password.length < 8) { setError('Use at least 8 characters for your new password.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword(''); setConfirmPassword(''); setPasswordOpen(false);
      setNotice('Password updated successfully.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update password. You may need to sign in again.'); }
    finally { setBusy(false); }
  };

  const card = 'rounded-xl border border-[#e4e0d8] bg-white p-5 sm:p-7 shadow-sm';
  const button = 'rounded-lg border border-[#d8ded8] px-4 py-2 text-sm font-medium text-[#174D3B] hover:bg-[#f0f5f1] disabled:opacity-50';
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8 text-[#172821]">
      <header className="mb-7"><h2 className="text-3xl font-semibold">Profile</h2><p className="mt-1 text-[#66736d]">Manage your personal information and account security.</p></header>
      {isDemo && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Demo mode: account changes are unavailable. Sign in to manage your account.</div>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className={card}>
        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold"><UserRound size={19}/> Profile Information</h3>
        <div className="mb-6 flex flex-wrap items-center gap-5 border-b pb-6">
          <FutureFieldAvatar size={88} isDemo={isDemo} />
          <div><div className="mb-2 text-sm font-medium">Profile Picture</div>
            <label className={`${button} inline-block cursor-pointer ${isDemo || photoBusy ? 'pointer-events-none opacity-50' : ''}`}>
              {photoBusy ? 'Uploading…' : 'Change Photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isDemo || photoBusy} onChange={e => { void uploadPhoto(e); }} />
            </label>
            <p className="mt-2 text-xs text-[#66736d]">JPG, PNG or WebP · Maximum 2 MB</p>
          </div>
        </div>
        <div className="space-y-5 text-sm">
          <div><div className="mb-1 text-[#66736d]">Full Name</div>{editingName && !isDemo ? <div className="flex flex-wrap gap-2"><input aria-label="Full Name" className="min-w-0 flex-1 rounded-lg border px-3 py-2" value={name} onChange={e => setName(e.target.value)}/><button disabled={busy} onClick={() => void saveName()} className={button}>Save</button><button onClick={() => setEditingName(false)} className={button}>Cancel</button></div> : <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{name || 'Not provided'}</span>{!isDemo && <button className={button} onClick={() => { resetMessage(); setEditingName(true); }}>Edit Name</button>}</div>}</div>
          <div className="border-t pt-4"><div className="mb-1 text-[#66736d]">Email Address</div><div className="font-medium break-all">{isDemo ? 'Demo account' : user?.email ?? 'Unavailable'}</div></div>
          <div className="border-t pt-4"><div className="mb-1 text-[#66736d]">Account Type</div><div className="font-medium">{isDemo ? 'Demo' : 'Personal Account'}</div></div>
        </div>
      </section>
      <section className={card}>
        <h3 className="mb-5 flex items-center gap-2 text-lg font-semibold"><KeyRound size={19}/> Security & Privacy</h3>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h4 className="font-semibold">Update Password</h4><p className="mt-1 text-sm text-[#66736d]">Set a new password for your account.</p></div><button disabled={isDemo || busy} onClick={() => { resetMessage(); setPasswordOpen(v => !v); }} className={button}>{passwordOpen ? 'Cancel' : 'Update Password'}</button></div>
        {passwordOpen && !isDemo && <form className="mt-5 max-w-md space-y-3" onSubmit={e => { e.preventDefault(); void savePassword(); }}><label className="block text-sm">New Password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-sm">Confirm New Password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><button disabled={busy} type="submit" className="rounded-lg bg-[#174D3B] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save Password'}</button><p className="text-xs text-[#66736d]">For security, Supabase may require you to sign in again before changing your password.</p></form>}
      </section>
      <section className={card}><h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><LogOut size={19}/> Account Actions</h3><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#66736d]">{isDemo ? 'Exit demo mode.' : 'Sign out of your FutureField account.'}</p><button disabled={busy} className={button} onClick={async () => { resetMessage(); setBusy(true); try { await onSignOut(); } catch(e) { setError(e instanceof Error ? e.message : 'Could not sign out.'); } finally { setBusy(false); } }}>{isDemo ? 'Exit Demo' : 'Sign Out'}</button></div></section>
    </div>
  );
}
