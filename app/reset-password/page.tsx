'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="wrap">
      <div className="login-header">
        <video autoPlay muted loop playsInline className="brand-video login-video">
          <source src="https://storage.googleapis.com/xsenassets/peak%20platforms.mp4" type="video/mp4" />
        </video>
        <a href="https://www.peak-platforms.com" className="brand-link">
          <h1>Peak Line</h1>
          <p className="tagline">by Peak Platforms</p>
        </a>
      </div>
      <p className="lede login-page-lede">Choose a new password.</p>

      <form className="note" onSubmit={handleSubmit}>
        <label>New password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />

        <div id="status">{status}</div>

        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}
