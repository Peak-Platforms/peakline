'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

type ClientLink = {
  id: string;
  client_name: string;
  room_url: string;
  calls_remaining: number;
  minutes_remaining: number;
  active: boolean;
  created_at: string;
};

export default function ClientLinksPage() {
  const [links, setLinks] = useState<ClientLink[]>([]);
  const [copiedId, setCopiedId] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('client_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setLinks(data as ClientLink[]);
    })();
  }, []);

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 1800);
  }

  return (
    <div className="wrap">
      <h1>Client links</h1>
      <p className="lede">
        Every reusable link you've created, and how much of its allotment is left.
      </p>
      <p className="usage"><Link href="/dashboard" className="nav-link">← Back to dashboard</Link></p>

      <div className="history">
        {links.length === 0 ? (
          <p className="empty">No reusable client links yet — create one from the dashboard.</p>
        ) : (
          links.map(link => (
            <div className="note client-link-card" key={link.id}>
              <div className="client-link-header">
                <span className="name">{link.client_name}</span>
                <span className={link.active ? 'badge-active' : 'badge-expired'}>
                  {link.active ? 'Active' : 'Expired'}
                </span>
              </div>
              <p className="allotment">
                {link.calls_remaining} call{link.calls_remaining === 1 ? '' : 's'} left ·{' '}
                {link.minutes_remaining} min left
              </p>
              {link.active && (
                <>
                  <div className="link">{link.room_url}</div>
                  {copiedId === link.id && <div className="toast">Copied</div>}
                  <button className="secondary" onClick={() => copyLink(link.room_url, link.id)}>
                    Copy link
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
