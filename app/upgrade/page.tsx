'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function UpgradePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-checkout-session', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError('Could not start checkout. Try again.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <p><Link href="/dashboard" className="nav-link">← Back to dashboard</Link></p>
      <h1>Upgrade to Unlimited</h1>
      <p className="lede">$39/mo — no monthly call cap, reusable client links, and white-label branding.</p>

      <div className="note">
        <ul style={{ marginBottom: 20, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Unlimited one-time client links</li>
          <li>Reusable links for repeat clients</li>
          <li>Your name, photo, and accent color on the client's call screen</li>
          <li>Remove "Powered by Peak Link" branding</li>
        </ul>

        {error && <div id="status">{error}</div>}
        <button onClick={handleUpgrade} disabled={loading}>
          {loading ? 'Redirecting…' : 'Upgrade to Unlimited — $39/mo'}
        </button>
      </div>
    </div>
  );
}