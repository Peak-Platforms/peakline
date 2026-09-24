'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type Status = 'loading' | 'error' | 'ready' | 'joining' | 'in-call';

function detectInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  const signatures = [
    'Instagram',
    'Line/',
    'MicroMessenger',
    'Twitter',
    'GmailApp',
    '; wv',
  ];

  if (signatures.some((sig) => ua.includes(sig))) return true;

  const isIOS = /iPhone|iPad|iPod/.test(ua);
  if (isIOS && ua.includes('AppleWebKit') && !ua.includes('Safari')) return true;

  return false;
}

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [clientName, setClientName] = useState<string | undefined>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShowInAppWarning(detectInAppBrowser());
  }, []);

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
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Something went wrong. Try again.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

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
    setStatus('joining');
  }

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

  function copyPageLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (status === 'error') {
    return (
      <CenteredMessage>
        {errorMessage}
        <div style={{ marginTop: 16 }}>
          <button onClick={tryAgain}>Try again</button>
        </div>
      </CenteredMessage>
    );
  }

  if (status === 'ready') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          {showInAppWarning && (
            <div
              style={{
                background: '#FFF4E5',
                border: '1px solid #F2A93B',
                borderRadius: 8,
                padding: '14px 16px',
                marginBottom: 20,
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              <strong>For the best experience, open this in your browser.</strong>
              <p style={{ marginTop: 6, marginBottom: 10 }}>
                Camera and microphone access can be blocked inside this app's built-in browser.
              </p>
              <button onClick={copyPageLink}>
                {copied ? 'Link copied' : 'Copy link'}
              </button>
              <p style={{ marginTop: 8, fontSize: 12.5, color: '#5B6472' }}>
                Then paste it into Chrome or Safari.
              </p>
            </div>
          )}

          <p style={{ marginBottom: 20 }}>
            {clientName ? `You're about to join your call.` : 'Ready to join your call.'}
          </p>
          <button onClick={handleJoin}>Join call</button>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ maxWidth: 320, textAlign: 'center' }}>{children}</p>
    </div>
  );
}