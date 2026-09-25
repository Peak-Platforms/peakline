'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type Status = 'loading' | 'error' | 'ready' | 'joining' | 'in-call';

type Branding = {
  displayName: string | null;
  businessName: string | null;
  accentColor: string;
  photoUrl: string | null;
  showBranding: boolean;
};

const DEFAULT_ACCENT = '#F2A93B';

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const signatures = ['Instagram', 'Line/', 'MicroMessenger', 'Twitter', 'GmailApp', '; wv'];
  if (signatures.some((sig) => ua.includes(sig))) return true;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  if (isIOS && ua.includes('AppleWebKit') && !ua.includes('Safari')) return true;
  return false;
}

function initials(name: string | null): string {
  if (!name) return '';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [clientName, setClientName] = useState<string | undefined>();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const accent = branding?.accentColor || DEFAULT_ACCENT;

  // Step 0: check the link is valid, and pick up the owner's branding
  useEffect(() => {
    let cancelled = false;

    fetch(`/api/call-info/${roomId}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrorMessage(body.message || 'This link is invalid.');
          setStatus('error');
          return;
        }
        setClientName(body.clientName);
        if (body.branding) setBranding(body.branding);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Something went wrong. Try again.');
          setStatus('error');
        }
      });

    setShowInAppWarning(detectInAppBrowser());

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Step 1: user clicks "Join call" — check eligibility, get the room URL,
  // then switch to 'joining' so the (now-visible) container mounts.
  async function handleJoin() {
    const res = await fetch(`/api/call-info/${roomId}/join`, { method: 'POST' });
    const body = await res.json();

    if (!res.ok) {
      setErrorMessage(
        body.error === 'limit_reached'
          ? 'This link has run out of calls.'
          : body.error === 'already_used'
          ? 'This one-time link has already been used.'
          : 'Could not join the call.'
      );
      setStatus('error');
      return;
    }

    setRoomUrl(body.roomUrl);
    setStatus('joining'); // container becomes visible now, before we connect
  }

  // Step 2: once 'joining' and the container is actually in the DOM and
  // visible, create the Daily frame and connect. Any Daily-side prompt or
  // spinner is now visible to the user, not hidden.
  useEffect(() => {
    if (status !== 'joining' || !roomUrl || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const DailyIframe = (await import('@daily-co/daily-js')).default;
        if (cancelled || !containerRef.current) return;

        const frame = DailyIframe.createFrame(containerRef.current, {
          url: roomUrl,
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0' },
        });
        callFrameRef.current = frame;

        await frame.join();
        if (cancelled) return;

        // Real connection succeeded — now consume the link's quota.
        fetch(`/api/call-info/${roomId}/confirm`, { method: 'POST' }).catch(() => {});

        setStatus('in-call');
      } catch {
        if (!cancelled) {
          setErrorMessage("Couldn't connect. You can try again with the same link.");
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, roomUrl, roomId]);

  useEffect(() => {
    return () => {
      callFrameRef.current?.destroy();
    };
  }, []);

  function tryAgain() {
    setRoomUrl(null);
    setStatus('ready');
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  }

  if (status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (status === 'error') {
    return (
      <CenteredMessage>
        {errorMessage}
        <div style={{ marginTop: 16 }}>
          <button onClick={tryAgain} style={buttonStyle(accent)}>Try again</button>
        </div>
      </CenteredMessage>
    );
  }

  if (status === 'ready') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <BrandingHeader branding={branding} />

          <p style={{ margin: '20px 0', fontSize: 16, color: '#333' }}>
            {clientName ? `You're about to join your call.` : 'Ready to join your call.'}
          </p>

          {showInAppWarning && (
            <div style={inAppWarningStyle}>
              <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.4 }}>
                This link opened inside another app's browser, which can block your camera and
                microphone. For the best connection, copy this link and open it in Chrome or
                Safari instead.
              </p>
              <button onClick={copyLink} style={{ ...buttonStyle('#fff'), color: '#8a6300', border: '1px solid #d8a900', background: '#fff', fontSize: 13, padding: '8px 14px' }}>
                {linkCopied ? 'Link copied' : 'Copy link'}
              </button>
            </div>
          )}

          <button onClick={handleJoin} style={buttonStyle(accent)}>Join call</button>
        </div>

        <BrandingFooter branding={branding} />
      </div>
    );
  }

  // 'joining' or 'in-call' — the container is visible in both, so whatever
  // Daily needs to show (device check, spinner, the call itself) is visible.
  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}

function BrandingHeader({ branding }: { branding: Branding | null }) {
  const name = branding?.displayName;
  const business = branding?.businessName;
  if (!name && !business && !branding?.photoUrl) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      {branding?.photoUrl ? (
        <img
          src={branding.photoUrl}
          alt={name || 'Host'}
          style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px', display: 'block', border: `2px solid ${branding.accentColor || DEFAULT_ACCENT}` }}
        />
      ) : name ? (
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: branding?.accentColor || DEFAULT_ACCENT, color: '#fff',
            fontSize: 24, fontWeight: 600,
          }}
        >
          {initials(name)}
        </div>
      ) : null}
      {name && <div style={{ fontSize: 18, fontWeight: 600, color: '#161B22' }}>{name}</div>}
      {business && <div style={{ fontSize: 14, color: '#5B6472' }}>{business}</div>}
    </div>
  );
}

function BrandingFooter({ branding }: { branding: Branding | null }) {
  if (branding && branding.showBranding === false) return null;
  return (
    <div style={{ position: 'fixed', bottom: 16, fontSize: 12, color: '#9aa1ab' }}>
      Powered by Peak Link
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

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ maxWidth: 320, textAlign: 'center' }}>{children}</p>
    </div>
  );
}