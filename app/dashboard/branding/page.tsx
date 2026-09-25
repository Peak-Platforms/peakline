'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const DEFAULT_ACCENT = '#F2A93B';

export default function BrandingPage() {
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showBranding, setShowBranding] = useState(true);
  const [tier, setTier] = useState<'basic' | 'unlimited'>('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [status, setStatus] = useState('');
  const [userId, setUserId] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const canWhiteLabel = tier === 'unlimited';

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('tier, display_name, business_name, accent_color, photo_url, show_branding')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.tier) setTier(profile.tier as 'basic' | 'unlimited');
        setDisplayName(profile.display_name || '');
        setBusinessName(profile.business_name || '');
        setAccentColor(profile.accent_color || DEFAULT_ACCENT);
        setPhotoUrl(profile.photo_url || null);
        setShowBranding(profile.show_branding ?? true);
      }
      setLoading(false);
    })();
  }, []);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploadingPhoto(true);
    setStatus('');

    const ext = file.name.split('.').pop();
    const path = `${userId}/photo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setStatus('Could not upload photo.');
      setUploadingPhoto(false);
      return;
    }

    const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
    // Bust cache in case a previous photo was cached at the same URL
    setPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
    setUploadingPhoto(false);
  }

  async function handleSave() {
    setSaving(true);
    setStatus('');

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || null,
        business_name: businessName.trim() || null,
        accent_color: canWhiteLabel ? accentColor : null,
        photo_url: canWhiteLabel ? photoUrl : null,
        show_branding: canWhiteLabel ? showBranding : true,
      })
      .eq('id', userId);

    setSaving(false);
    setStatus(error ? 'Could not save changes.' : 'Saved.');
  }

  if (loading) {
    return <div className="wrap"><p>Loading…</p></div>;
  }

  return (
    <div className="wrap">
      <p><Link href="/dashboard" className="nav-link">← Back to dashboard</Link></p>
      <h1>Client-facing branding</h1>
      <p className="lede">
        This is what your clients see on the call landing screen before they join.
      </p>

      <div className="note">
        <label>Your name (shown to clients)</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Jane Smith" />

        <label>Business name (optional)</label>
        <input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Smith Realty Group" />

        {canWhiteLabel ? (
          <>
            <label>Accent color</label>
            <input
              type="color"
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              style={{ width: 60, height: 36, padding: 0, border: 'none', cursor: 'pointer' }}
            />

            <label style={{ marginTop: 16 }}>Photo</label>
            {photoUrl && (
              <img
                src={photoUrl}
                alt="Your photo"
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '8px 0' }}
              />
            )}
            <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
            {uploadingPhoto && <p className="hint">Uploading…</p>}

            <label style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!showBranding}
                onChange={e => setShowBranding(!e.target.checked)}
                style={{ width: 'auto' }}
              />
              Remove "Powered by Peak Link" footer
            </label>
          </>
        ) : (
          <div className="upgrade" style={{ marginTop: 16 }}>
            <p className="hint">
              Accent color, photo, and removing the "Powered by Peak Link" footer are available on Unlimited.
            </p>
            <a href="/upgrade" className="upgrade-btn">Upgrade to Unlimited</a>
          </div>
        )}

        <div id="status">{status}</div>
        <button onClick={handleSave} disabled={saving} style={{ marginTop: 16 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}