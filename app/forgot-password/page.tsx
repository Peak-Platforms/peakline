'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
      <p className="lede login-page-lede">Reset your password.</p>

      {sent ? (
        <div className="note">
          <p className="hint">Check your email for a link to reset your password.</p>
          <Link href="/login" className="upgrade-btn" style={{ display: 'block', textAlign: 'center' }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="note" onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />

          <div id="status">{status}</div>

          <button type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>

          <Link href="/login" className="secondary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '10px', padding: '13px', border: '1px solid var(--paper-line)', borderRadius: '4px' }}>
            Back to sign in
          </Link>
        </form>
      )}
    </div>
  );
}
