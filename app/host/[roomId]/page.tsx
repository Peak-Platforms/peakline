'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Status = 'loading' | 'error' | 'ready' | 'joining' | 'in-call';

export default function HostCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
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
          setErrorMessage(
            body.error === 'not_your_link'
              ? "This link doesn't belong to your account."
              : 'This link is invalid.'
          );
          setStatus('error');
          return;
        }

        setRoomUrl(body.roomUrl);
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
  }, [roomId, router]);

  function handleJoin() {
    setStatus('joining'); // container becomes visible now, before we connect
  }

  // Once 'joining' and the container is actually in the DOM and visible,
  // create the Daily frame and connect.
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

        setStatus('in-call');
      } catch {
        if (!cancelled) {
          setErrorMessage("Couldn't connect. You can try again.");
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, roomUrl]);

  useEffect(() => {
    return () => {
      callFrameRef.current?.destroy();
    };
  }, []);

  if (status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (status === 'error') {
    return <CenteredMessage>{errorMessage}</CenteredMessage>;
  }

  if (status === 'ready') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ marginBottom: 20 }}>Ready to start this call.</p>
          <button onClick={handleJoin}>Join call</button>
        </div>
      </div>
    );
  }

  // 'joining' or 'in-call' — container is visible in both, so Daily's own
  // connection/device-check UI and the call itself are both visible.
  return <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ maxWidth: 320, textAlign: 'center' }}>{children}</p>
    </div>
  );
}