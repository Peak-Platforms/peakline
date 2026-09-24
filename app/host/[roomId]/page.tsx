'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type HostState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready' }
  | { status: 'in-call' };

export default function HostCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [state, setState] = useState<HostState>({ status: 'loading' });
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const callFrameRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/call-info/${roomId}/host`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;

        if (res.status === 401) {
          router.push('/login');
          return;
        }
        if (!res.ok) {
          setState({
            status: 'error',
            message: body.error === 'not_your_link'
              ? "This link doesn't belong to your account."
              : 'This link is invalid.',
          });
          return;
        }

        setRoomUrl(body.roomUrl);
        setState({ status: 'ready' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Something went wrong. Try again.' });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId, router]);

  async function handleJoin() {
    if (!roomUrl || !containerRef.current) return;

    const DailyIframe = (await import('@daily-co/daily-js')).default;

    const frame = DailyIframe.createFrame(containerRef.current, {
      url: roomUrl,
      showLeaveButton: true,
      iframeStyle: { width: '100%', height: '100%', border: '0' },
    });
    callFrameRef.current = frame;
    await frame.join();
    setState({ status: 'in-call' });
  }

  useEffect(() => {
    return () => {
      callFrameRef.current?.destroy();
    };
  }, []);

  if (state.status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (state.status === 'error') {
    return <CenteredMessage>{state.message}</CenteredMessage>;
  }

  if (state.status === 'in-call') {
    return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <p style={{ marginBottom: 20 }}>Ready to start this call.</p>
        <button onClick={handleJoin}>Join call</button>
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