'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CallRoom from '../../components/CallRoom';

type Status = 'loading' | 'error' | 'ready' | 'joining' | 'in-call' | 'left';

export default function HostCallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [roomUrl, setRoomUrl] = useState<string | null>(null);

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
    setStatus('joining');
  }

  if (status === 'loading') {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (status === 'error') {
    return (
      <CenteredMessage>
        {errorMessage}
        {roomUrl && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setStatus('ready')}>Try again</button>
          </div>
        )}
      </CenteredMessage>
    );
  }

  if (status === 'left') {
    return (
      <CenteredMessage>
        You left the call.
        <div style={{ marginTop: 16 }}>
          <button onClick={handleJoin}>Rejoin</button>
        </div>
      </CenteredMessage>
    );
  }

  if (status === 'ready') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="brand-row" style={{ marginBottom: 20 }}>
          <video autoPlay muted loop playsInline className="brand-video">
            <source src="https://storage.googleapis.com/xsenassets/peak%20platforms.mp4" type="video/mp4" />
          </video>
          <h1 className="brand-title">Peak Link</h1>
        </div>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ marginBottom: 20 }}>Ready to start this call.</p>
          <button onClick={handleJoin}>Join call</button>
          <p style={{ marginTop: 16, fontSize: 12, color: '#8a94a3' }}>
            Please allow camera and microphone access when prompted.
          </p>
        </div>
      </div>
    );
  }

  // 'joining' or 'in-call' — one CallRoom instance covers both so it never remounts.
  return (
    <CallRoom
      roomUrl={roomUrl!}
      remoteLabel="Client"
      onJoined={() => setStatus('in-call')}
      onLeft={() => setStatus('left')}
      onError={(message) => {
        setErrorMessage(message);
        setStatus('error');
      }}
    />
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 320, textAlign: 'center' }}>{children}</div>
    </div>
  );
}
