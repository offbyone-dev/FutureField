import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const avatarPath = (userId: string) => `${userId}/profile`;
export const AVATAR_UPDATED = 'futurefield-avatar-updated';

export default function FutureFieldAvatar({ size = 36, isDemo = false }: { size?: number; isDemo?: boolean }) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setUrl(null);
      if (isDemo || !user?.id) return;
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(avatarPath(user.id), 3600);
      if (alive) setUrl(error ? null : `${data.signedUrl}&v=${Date.now()}`);
    };
    void load();
    window.addEventListener(AVATAR_UPDATED, load);
    return () => { alive = false; window.removeEventListener(AVATAR_UPDATED, load); };
  }, [user?.id, isDemo]);
  return <span className="inline-flex shrink-0 overflow-hidden items-center justify-center rounded-full border border-[#cbd7ce] bg-[#e3eee7] text-[#174D3B] font-semibold" style={{ width: size, height: size, fontSize: Math.max(13, size / 2.5) }}>
    {url ? <img src={url} alt="Profile" className="h-full w-full object-cover" onError={() => setUrl(null)} /> : (isDemo ? 'D' : (user?.user_metadata?.full_name?.[0] || user?.email?.[0] || 'U').toUpperCase())}
  </span>;
}
