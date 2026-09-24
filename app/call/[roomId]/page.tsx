'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type CallInfo =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; clientName?: string }
  | { status: 'joining' }
  | { status: 'in-call' };

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [info, setInfo] = useState<CallInfo>({ status: 'loading' });
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/call-info/${roomId}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setInfo({ status: 'error', message: body.message || 'This link is invalid.' });
          return;
        }
        setInfo({ status: 'ready', clientName: body.clientName });
      })
      .catch(() => {
        if (!cancelled) setInfo({ status: 'error', message: 'Something went wrong. Try again.' });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  async function handleJoin() {
    setInfo({ status: 'joining' });

    // Step 1: check eligibility and get the room URL — does NOT consume quota yet
    const res = await fetch(`/api/call-info/${roomId}/join`, { method: 'POST' });
    const body = await res.json();

    if (!res.ok) {
      setInfo({ status: 'error', message: body.error === 'limit_reached'
        ? 'This link has run out of calls.'
        : body.error === 'already_used'
        ? 'This one-time link has already been used.'
        : 'Could not join the call.' });
      return;
    }

    try {
      const DailyIframe = (await import('@daily-co/daily-js')).default;

      if (!containerRef.current) return;

      const frame = DailyIframe.createFrame(containerRef.current, {
        url: body.roomUrl,
        showLeaveButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0' },
      });
      callFrameRef.current = frame;

      // This is the actual connection point — camera/mic permission happens here.
      // If the user denies permission or backs out, this throws/rejects and we
      // never reach the confirm step below, so the link stays unconsumed.
      await frame.join();

      // Step 2: only now, after a real connection, consume the quota.
      fetch(`/api/call-info/${roomId}/confirm`, { method: 'POST' }).catch(() => {
        // Non-fatal if this fails — worst case a link doesn't get marked used.
        // Better than blocking a real user who already connected.
      });

      setInfo({ status: 'in-call' });
    } catch {
      // Join failed or was cancelled (e.g. permission denied) — nothing was
      // consumed, so let them try again.
      setInfo({ status: 'error', message: "Couldn't connect. You can try again with the same link." });
    }
  }

  useEffect(() => {
    return () => {
      callFrameRef.current?.destroy();
    };
  }, []);

  if (info.status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (info.status === 'error') {
    return (
      <CenteredMessage>
        {info.message}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setInfo({ status: 'ready' })}>Try again</button>
        </div>
      </CenteredMessage>
    );
  }

  if (info.status === 'in-call') {
    return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <p style={{ marginBottom: 20 }}>
          {info.status === 'ready' && info.clientName
            ? `You're about to join your call.`
            : 'Ready to join your call.'}
        </p>
        <button onClick={handleJoin} disabled={info.status === 'joining'}>
          {info.status === 'joining' ? 'Connecting…' : 'Join call'}
        </button>
      </div>
      <div ref={containerRef} style={{ display: 'none' }} />
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ maxWidth: 320, textAlign: 'center' }}>{children}</p>
    </div>
  );
}