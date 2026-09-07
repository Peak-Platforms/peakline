'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

type CallRow = { id: string; client_name: string; created_at: string };

export default function Dashboard() {
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastLink, setLastLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<CallRow[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [tier, setTier] = useState<'basic' | 'unlimited'>('basic');
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const BASIC_LIMIT = 10;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      if (profile?.tier) setTier(profile.tier as 'basic' | 'unlimited');

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());
      setUsedThisMonth(count || 0);

      const { data } = await supabase
        .from('calls')
        .select('id, client_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

      if (data) setHistory(data as CallRow[]);
    })();
  }, []);

  async function createRoom() {
    setStatus('');
    if (!clientName.trim()) { setStatus('Enter a client name first.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: clientName.trim() })
      });
      const data = await res.json();

      if (res.status === 402) {
        setLimitReached(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setStatus(data.error || 'Could not create link.');
        setLoading(false);
        return;
      }

      setLastLink(data.url);
      setCopied(false);
      setUsedThisMonth(usedThisMonth + 1);
      setHistory([{ id: crypto.randomUUID(), client_name: clientName.trim(), created_at: new Date().toISOString() }, ...history].slice(0, 8));
      setClientName('');
    } catch {
      setStatus('Network error creating link.');
    }
    setLoading(false);
  }

  function copyLink() {
    if (!lastLink) return;
    navigator.clipboard.writeText(lastLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="wrap">
      <div className="brand-row">
        <video autoPlay muted loop playsInline className="brand-video">
          <source src="https://storage.googleapis.com/xsenassets/peak%20platforms.mp4" type="video/mp4" />
        </video>
        <span>Peak Line</span>
        <button className="signout" onClick={signOut}>Sign out</button>
      </div>

      <h1>Send a private line</h1>
      <p className="lede">Signed in as {userEmail}. Each link is fresh, encrypted, and just for one client.</p>
      {tier === 'basic' && (
        <p className="usage">{usedThisMonth} of {BASIC_LIMIT} calls used this month</p>
      )}

      {limitReached ? (
        <div className="note upgrade">
          <h2 className="upgrade-title">You've used all {BASIC_LIMIT} calls this month</h2>
          <p className="hint">Upgrade to Unlimited to keep sending private lines — $39/mo, no monthly cap.</p>
          {/* Replace this href with your real Stripe checkout link once billing is wired up */}
          <a href="/upgrade" className="upgrade-btn">Upgrade to Unlimited</a>
        </div>
      ) : (
      <div className="note">
        <label>Client name</label>
        <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="For your reference only" />

        <div id="status">{status}</div>
        <button onClick={createRoom} disabled={loading}>
          {loading ? 'Creating…' : 'Create call link'}
        </button>

        {lastLink && (
          <div className="result">
            <p className="hint">Send this to your client. It's theirs alone.</p>
            <div className="link">{lastLink}</div>
            {copied && <div className="toast">Copied</div>}
            <button className="secondary" onClick={copyLink}>Copy link</button>
            <button onClick={() => window.open(lastLink, '_blank')}>Join call now</button>
          </div>
        )}
      </div>
      )}

      <div className="history">
        <h2>Recent lines</h2>
        {history.length === 0 ? (
          <p className="empty">Nothing sent yet.</p>
        ) : (
          history.map(h => (
            <div className="hist-item" key={h.id}>
              <span className="name">{h.client_name}</span>
              <span className="time">{new Date(h.created_at).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
