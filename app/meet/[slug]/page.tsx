'use client';

// The join page for a Peak Link Groups room.
// Guests type their name and join from the browser with no account, once a
// meeting is under way. Hosts can start the meeting. A host is the room's owner
// (signed in to Peak Link) or anyone who opened the room's staff link, which is
// this same page with ?host=<key> on the end.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import GroupRoom, { type LeftReason } from '../../components/GroupRoom';

type Status = 'loading' | 'missing' | 'ready' | 'waiting' | 'in-call' | 'left';

type Branding = {
  displayName: string | null;
  businessName: string | null;
  accentColor: string;
  photoUrl: string | null;
  showBranding: boolean;
};

const DEFAULT_ACCENT = '#F2A93B';
const NAME_KEY = 'peaklink-name';
const WAIT_POLL_MS = 5000;

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const signatures = ['Instagram', 'Line/', 'MicroMessenger', 'Twitter', 'GmailApp', '; wv'];
  if (signatures.some((sig) => ua.includes(sig))) return true;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  if (isIOS && ua.includes('AppleWebKit') && !ua.includes('Safari')) return true;
  return false;
}

export default function MeetPage() {
  const { slug } = useParams<{ slug: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [roomName, setRoomName] = useState('');
  const [branding, setBranding] = useState<Branding | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [staffLinkExpired, setStaffLinkExpired] = useState(false);
  const hostKey = useRef('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState<{ roomUrl: string; token: string } | null>(null);
  const [leftReason, setLeftReason] = useState<LeftReason>('left');
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the guest taps Cancel, so a check already on its way is ignored.
  const waitCancelled = useRef(false);

  const accent = branding?.accentColor || DEFAULT_ACCENT;

  // Look the room up, and pick up the owner's branding.
  useEffect(() => {
    let cancelled = false;

    // A staff link carries its key on the end of the address.
    try {
      hostKey.current = new URLSearchParams(window.location.search).get('host') || '';
    } catch {
      hostKey.current = '';
    }
    const query = hostKey.current ? `?host=${encodeURIComponent(hostKey.current)}` : '';

    fetch(`/api/groups/${slug}${query}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setMessage(body.message || 'This meeting link is not valid.');
          setStatus('missing');
          return;
        }
        setRoomName(body.name);
        setBranding(body.branding || null);
        setIsHost(!!body.isHost);
        setIsOwner(!!body.isOwner);
        setStaffLinkExpired(!!body.staffLinkExpired);

        let saved = '';
        try {
          saved = window.localStorage.getItem(NAME_KEY) || '';
        } catch {
          /* private browsing: just start with an empty name */
        }
        setName(body.isOwner ? body.branding?.displayName || saved : saved);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setMessage('Something went wrong. Check your connection and reload this page.');
          setStatus('missing');
        }
      });

    setShowInAppWarning(detectInAppBrowser());

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Stop checking for the host if the page goes away.
  useEffect(() => {
    return () => {
      waitCancelled.current = true;
      if (waitTimer.current) clearTimeout(waitTimer.current);
    };
  }, []);

  async function requestPass(): Promise<void> {
    let res: Response;
    let body: any;
    try {
      res = await fetch(`/api/groups/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), hostKey: hostKey.current || undefined }),
      });
      body = await res.json();
    } catch {
      if (waitCancelled.current) return;
      setMessage('Network error. Try again.');
      setStatus('ready');
      return;
    }

    if (waitCancelled.current) return;

    if (!res.ok) {
      setMessage(body.message || 'Could not join the meeting.');
      setStatus('ready');
      return;
    }

    if (body.waiting) {
      // The host hasn't opened the room yet. Keep checking until they do.
      setStatus('waiting');
      waitTimer.current = setTimeout(requestPass, WAIT_POLL_MS);
      return;
    }

    setPass({ roomUrl: body.roomUrl, token: body.token });
    setIsHost(!!body.isHost);
    setStatus('in-call');
  }

  async function handleJoin() {
    setMessage('');
    if (!isOwner && !name.trim()) {
      setMessage('Enter your name to join.');
      return;
    }
    try {
      window.localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      /* fine without it */
    }
    setBusy(true);
    waitCancelled.current = false;
    await requestPass();
    setBusy(false);
  }

  function stopWaiting() {
    waitCancelled.current = true;
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = null;
    setStatus('ready');
  }

  function backToStart() {
    setPass(null);
    setMessage('');
    setStatus('ready');
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  }

  if (status === 'loading') {
    return <Centered>Loading…</Centered>;
  }

  if (status === 'missing') {
    return <Centered>{message}</Centered>;
  }

  if (status === 'left') {
    return (
      <Centered>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {leftReason === 'ended'
            ? 'Meeting ended'
            : leftReason === 'removed'
              ? 'The meeting has ended for you'
              : "You've left the meeting"}
        </div>
        <div style={{ fontSize: 14, color: '#5B6472' }}>
          {leftReason === 'ended'
            ? 'Everyone has been disconnected.'
            : leftReason === 'removed'
              ? 'The host ended the meeting or removed you from it.'
              : 'You can come back in with the same link.'}
        </div>
        {leftReason !== 'removed' && (
          <div style={{ marginTop: 16 }}>
            <button onClick={backToStart} style={buttonStyle(accent)}>
              {leftReason === 'ended' ? 'Start again' : 'Rejoin'}
            </button>
          </div>
        )}
      </Centered>
    );
  }

  if (status === 'in-call' && pass) {
    return (
      <GroupRoom
        roomUrl={pass.roomUrl}
        token={pass.token}
        isHost={isHost}
        roomName={roomName}
        accent={accent}
        logoUrl={branding?.photoUrl}
        onLeft={(reason) => {
          setLeftReason(reason);
          setPass(null);
          setStatus('left');
        }}
        onError={(msg) => {
          setPass(null);
          setMessage(msg);
          setStatus('ready');
        }}
      />
    );
  }

  // 'ready' or 'waiting'
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 340 }}>
        {branding?.photoUrl && (
          <img
            src={branding.photoUrl}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px', display: 'block', border: `2px solid ${accent}` }}
          />
        )}
        <div style={{ fontSize: 22, fontWeight: 600, color: '#161B22' }}>{roomName}</div>
        {branding?.businessName && branding.businessName !== roomName && (
          <div style={{ fontSize: 14, color: '#5B6472', marginTop: 2 }}>{branding.businessName}</div>
        )}

        {status === 'waiting' ? (
          <>
            <p style={{ margin: '24px 0 6px', fontSize: 16, color: '#333' }}>
              Waiting for the host to start the meeting…
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8a94a3' }}>
              Keep this page open. You'll be let in automatically.
            </p>
            <button onClick={stopWaiting} style={{ ...buttonStyle('#fff'), color: '#333', border: '1px solid #d5d9df' }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: '20px 0 16px', fontSize: 15, color: '#333' }}>
              {isOwner
                ? "You're the host of this room."
                : isHost
                  ? 'You can start this meeting. Enter your name.'
                  : 'Enter your name to join the meeting.'}
            </p>

            {staffLinkExpired && (
              <div style={inAppWarningStyle}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4 }}>
                  This staff link has been replaced, so it can no longer start meetings. Ask the
                  room's owner for the new one. You can still join as a guest.
                </p>
              </div>
            )}

            {showInAppWarning && (
              <div style={inAppWarningStyle}>
                <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.4 }}>
                  This link opened inside another app's browser, which can block your camera and
                  microphone. For the best connection, copy this link and open it in Chrome or
                  Safari instead.
                </p>
                <button onClick={copyLink} style={{ ...buttonStyle('#fff'), color: '#8a6300', border: '1px solid #d8a900', fontSize: 13, padding: '8px 14px' }}>
                  {linkCopied ? 'Link copied' : 'Copy link'}
                </button>
              </div>
            )}

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) handleJoin();
              }}
              placeholder="Your name"
              aria-label="Your name"
              maxLength={40}
              autoComplete="name"
              style={{ textAlign: 'center', marginBottom: 4 }}
            />

            {message && <div style={{ fontSize: 13, color: '#8B3A3A', marginTop: 8 }}>{message}</div>}

            <button onClick={handleJoin} disabled={busy} style={{ ...buttonStyle(accent), width: '100%', marginTop: 14 }}>
              {busy ? 'Joining…' : isHost ? 'Start meeting' : 'Join meeting'}
            </button>

            <p style={{ marginTop: 16, fontSize: 12, color: '#8a94a3' }}>
              Please allow camera and microphone access when prompted.
            </p>
          </>
        )}
      </div>

      {(!branding || branding.showBranding !== false) && (
        <div style={{ position: 'fixed', bottom: 16, fontSize: 12, color: '#9aa1ab' }}>Powered by Peak Link</div>
      )}
    </div>
  );
}

function buttonStyle(accent: string): React.CSSProperties {
  return {
    background: accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 28px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    width: 'auto',
    margin: 0,
  };
}

const inAppWarningStyle: React.CSSProperties = {
  background: '#fff8e5',
  border: '1px solid #f2d98a',
  borderRadius: 8,
  padding: '12px 14px',
  margin: '0 0 16px',
  textAlign: 'left',
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 320, textAlign: 'center' }}>{children}</div>
    </div>
  );
}
