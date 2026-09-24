'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type Status = 'loading' | 'error' | 'ready' | 'joining' | 'in-call';

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [clientName, setClientName] = useState<string | undefined>();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Step 0: check the link is valid
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
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ marginBottom: 20 }}>
            {clientName ? `You're about to join your call.` : 'Ready to join your call.'}
          </p>
          <button onClick={handleJoin}>Join call</button>
        </div>
      </div>
    );
  }

  // 'joining' or 'in-call' — the container is visible in both, so whatever
  // Daily needs to show (device check, spinner, the call itself) is visible.
  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ maxWidth: 320, textAlign: 'center' }}>{children}</p>
    </div>
  );
}