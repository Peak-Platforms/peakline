'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const search = window.location.search;
    const hash = window.location.hash;
    const confirmed =
      search.includes('code=') ||
      hash.includes('type=signup') ||
      hash.includes('access_token');

    if (confirmed) {
      setJustConfirmed(true);
      // Clean the URL so a refresh doesn't keep showing the banner or the token in the address bar
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    setLoading(true);

    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });

    const { data, error } = await fn;

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      const alreadyRegistered = data.user?.identities?.length === 0;
      setStatus(
        alreadyRegistered
          ? 'This email is already registered. Try signing in instead.'
          : 'Check your email to confirm your account, then sign in.'
      );
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
          <h1>Peak Link</h1>
          <p className="tagline">by Peak Platforms</p>
        </a>
      </div>
      <p className="lede login-page-lede">Sign in to create secure, encrypted video call links — one-time or reusable, always private.</p>

      {justConfirmed && (
        <div className="note" style={{ background: '#eefbf2', border: '1px solid #a6e3b8', marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#1a7a3d', fontWeight: 600 }}>
            Your account is confirmed — sign in below to get started.
          </p>
        </div>
      )}

      <form className="note" onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />

        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />

        <div id="status">{status}</div>

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="secondary"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setStatus(''); }}
        >
          {mode === 'signin' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>

        {mode === 'signin' && (
          <p className="usage" style={{ textAlign: 'center', marginTop: '14px' }}>
            <Link href="/forgot-password" className="nav-link">Forgot your password?</Link>
          </p>
        )}
      </form>
    </div>
  );
}