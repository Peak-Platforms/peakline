'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function UpgradePage() {
  const [loading, setLoading] = useState<'' | 'starter' | 'unlimited'>('');
  const [error, setError] = useState('');

  async function handleUpgrade(plan: 'starter' | 'unlimited') {
    setLoading(plan);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError('Could not start checkout. Try again.');
        setLoading('');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Try again.');
      setLoading('');
    }
  }

  return (
    <div className="wrap">
      <div className="brand-row">
        <video autoPlay muted loop playsInline className="brand-video">
          <source src="https://storage.googleapis.com/xsenassets/peak%20platforms.mp4" type="video/mp4" />
        </video>
        <h1 className="brand-title">Peak Link</h1>
      </div>

      <p><Link href="/dashboard" className="nav-link">← Back to dashboard</Link></p>
      <h2 className="page-title">Choose a plan</h2>
      <p className="lede">Both plans are month to month. Cancel anytime.</p>

      <div className="note">
        <h3 style={{ marginBottom: 4 }}>Starter — $10/mo</h3>
        <ul style={{ marginBottom: 20, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>200 call minutes each month</li>
          <li>Minutes reset every month and do not roll over</li>
          <li>A call already in progress can finish when your minutes run out</li>
        </ul>
        <button onClick={() => handleUpgrade('starter')} disabled={loading !== ''}>
          {loading === 'starter' ? 'Redirecting…' : 'Start Starter — $10/mo'}
        </button>
      </div>

      <div className="note" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>Unlimited — founders price $39/mo</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          Founders price for your first year, limited to the first 100 founding clients. Then $59/mo.
        </p>
        <ul style={{ marginBottom: 20, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Unlimited call minutes</li>
          <li>Reusable links for repeat clients</li>
          <li>Your name, photo, and accent color on the client's call screen</li>
          <li>Remove "Powered by Peak Link" branding</li>
        </ul>

        {error && <div id="status">{error}</div>}
        <button onClick={() => handleUpgrade('unlimited')} disabled={loading !== ''}>
          {loading === 'unlimited' ? 'Redirecting…' : 'Upgrade to Unlimited'}
        </button>

        <p style={{ marginTop: 16, fontSize: 12, color: '#8a94a3', lineHeight: 1.5 }}>
          Unlimited calls for professional client use. Each call is one-to-one and lasts up to
          6 hours. Fair use applies — see our{' '}
          <a href="https://getpeaklink.com/terms" target="_blank" rel="noreferrer">Terms</a>.
        </p>
      </div>
    </div>
  );
}
