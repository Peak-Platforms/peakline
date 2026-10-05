'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js';

type Props = {
  /** Daily room URL to join. */
  roomUrl: string;
  /** Called once, right after the connection to the room succeeds. */
  onJoined?: () => void;
  /** Called when the user leaves (or is removed from) the call. */
  onLeft?: () => void;
  /** Called if joining fails or the call hits a fatal error. */
  onError?: (message: string) => void;
  /** Label shown on the other person's tile. */
  remoteLabel?: string;
  /** Accent color for the primary highlights. */
  accent?: string;
  /** Professional's logo/photo, shown small in the bottom-right corner. */
  logoUrl?: string | null;
};

type TrackInfo = { track: MediaStreamTrack | null; on: boolean };

type Snapshot = {
  local: { video: TrackInfo };
  remote: { present: boolean; video: TrackInfo; audio: MediaStreamTrack | null } | null;
};

const EMPTY: Snapshot = { local: { video: { track: null, on: false } }, remote: null };

function pickTrack(t: DailyParticipant['tracks']['video'] | undefined): TrackInfo {
  if (!t) return { track: null, on: false };
  const usable = t.state === 'playable' || t.state === 'interrupted';
  const track = usable ? t.persistentTrack ?? t.track ?? null : null;
  return { track, on: !!track };
}

function snapshot(call: DailyCall): Snapshot {
  const all = call.participants();
  const local = all.local;
  const remoteList = Object.values(all).filter((p) => !p.local);
  const r = remoteList[0];
  return {
    local: { video: pickTrack(local?.tracks?.video) },
    remote: r
      ? {
          present: true,
          video: pickTrack(r.tracks?.video),
          audio:
            r.tracks?.audio && (r.tracks.audio.state === 'playable' || r.tracks.audio.state === 'interrupted')
              ? r.tracks.audio.persistentTrack ?? r.tracks.audio.track ?? null
              : null,
        }
      : null,
  };
}

/* ───────── small pieces ───────── */

function VideoSurface({
  track,
  mirrorIfFront,
  fit,
}: {
  track: MediaStreamTrack | null;
  mirrorIfFront?: boolean;
  fit: 'contain' | 'cover';
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [mirror, setMirror] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (track) {
      el.srcObject = new MediaStream([track]);
      el.play().catch(() => {});
      if (mirrorIfFront) {
        // Rear ("environment") cameras should not be mirrored.
        const facing = track.getSettings?.().facingMode;
        setMirror(facing !== 'environment');
      }
    } else {
      el.srcObject = null;
    }
  }, [track, mirrorIfFront]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{
        width: '100%',
        height: '100%',
        objectFit: fit,
        background: '#000',
        display: 'block',
        transform: mirrorIfFront && mirror ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1c2430',
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textAlign: 'center',
        padding: 8,
      }}
    >
      {text}
    </div>
  );
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const MicIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
const MicOffIcon = () => (
  <svg {...iconProps}>
    <path d="M3 3l18 18" />
    <path d="M9 9v2a3 3 0 0 0 5 2.2M15 9.3V6a3 3 0 0 0-5.7-1.3" />
    <path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.6 2.8M12 18v3" />
  </svg>
);
const CamIcon = () => (
  <svg {...iconProps}>
    <rect x="2" y="6" width="13" height="12" rx="2" />
    <path d="M15 10l7-4v12l-7-4" />
  </svg>
);
const CamOffIcon = () => (
  <svg {...iconProps}>
    <path d="M3 3l18 18" />
    <path d="M7 6h6a2 2 0 0 1 2 2v3.5M15 14.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2" />
    <path d="M15 10l7-4v12l-4-2.3" />
  </svg>
);
const FlipIcon = () => (
  <svg {...iconProps}>
    <path d="M4 8V6a2 2 0 0 1 2-2h3l1.5 2H18a2 2 0 0 1 2 2v2" />
    <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
    <path d="M9 12a3 3 0 0 1 5.2-2M15 12a3 3 0 0 1-5.2 2" />
    <path d="M14.5 8.5v2h-2M9.5 15.5v-2h2" />
  </svg>
);
const SwapIcon = () => (
  <svg {...iconProps}>
    <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
  </svg>
);
const LeaveIcon = () => (
  <svg {...iconProps}>
    <path d="M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a11 11 0 0 0-7 0V15l-3 1.5L3 14z" />
  </svg>
);

function RoundButton({
  label,
  onClick,
  children,
  active = true,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const bg = danger ? '#c0392b' : active ? 'rgba(255,255,255,0.16)' : '#fff';
  const color = danger ? '#fff' : active ? '#fff' : '#161B22';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 52,
        height: 52,
        padding: 0,
        margin: 0,
        borderRadius: '50%',
        border: 'none',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flex: '0 0 auto',
        outline: 'none',
      }}
    >
      {children}
    </button>
  );
}

/* ───────── main component ───────── */

export default function CallRoom({
  roomUrl,
  onJoined,
  onLeft,
  onError,
  remoteLabel = 'Other person',
  accent = '#F2A93B',
  logoUrl = null,
}: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cbRef = useRef({ onJoined, onLeft, onError });
  cbRef.current = { onJoined, onLeft, onError };

  const [connected, setConnected] = useState(false);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [cameraCount, setCameraCount] = useState(0);
  const [swapped, setSwapped] = useState(false); // false: other person big, you small
  const [notice, setNotice] = useState('');
  const [hint, setHint] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const hintShown = useRef(false);

  const refresh = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    setSnap(snapshot(call));
    setMicOn(call.localAudio());
    setCamOn(call.localVideo());
  }, []);

  /* Create the call object and join. Depends only on the room URL. */
  useEffect(() => {
    let cancelled = false;
    let call: DailyCall | null = null;

    (async () => {
      try {
        const Daily = (await import('@daily-co/daily-js')).default;
        if (cancelled) return;

        // Only one Daily instance may exist at a time (also guards React dev double-mount).
        const existing = Daily.getCallInstance();
        if (existing) await existing.destroy();
        if (cancelled) return;

        call = Daily.createCallObject();
        callRef.current = call;

        const onChange = () => refresh();
        call.on('participant-joined', onChange);
        call.on('participant-updated', onChange);
        call.on('participant-left', onChange);
        call.on('joined-meeting', onChange);
        call.on('camera-error', () => {
          setNotice('Camera or microphone is blocked. Check your browser permissions, then rejoin.');
        });
        call.on('error', (e: any) => {
          cbRef.current.onError?.(e?.errorMsg || 'The call ended unexpectedly.');
        });
        call.on('left-meeting', () => {
          if (!cancelled) cbRef.current.onLeft?.();
        });

        await call.join({ url: roomUrl });
        if (cancelled) return;

        setConnected(true);
        refresh();
        cbRef.current.onJoined?.();

        try {
          const { devices } = await call.enumerateDevices();
          if (!cancelled) setCameraCount(devices.filter((d) => d.kind === 'videoinput').length);
        } catch {
          /* flip button just stays hidden */
        }
      } catch (err: any) {
        if (!cancelled) {
          cbRef.current.onError?.(
            typeof err?.errorMsg === 'string'
              ? err.errorMsg
              : "Couldn't connect. You can try again."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const c = call;
      callRef.current = null;
      if (c) {
        c.leave().catch(() => {}).finally(() => c.destroy().catch(() => {}));
      }
    };
  }, [roomUrl, refresh]);

  /* Remote audio. */
  const remoteAudio = snap.remote?.audio ?? null;
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (remoteAudio) {
      el.srcObject = new MediaStream([remoteAudio]);
      el.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    } else {
      el.srcObject = null;
    }
  }, [remoteAudio]);

  /* One-time hint when the other person first appears. */
  const remotePresent = !!snap.remote?.present;
  useEffect(() => {
    if (remotePresent && !hintShown.current) {
      hintShown.current = true;
      setHint(true);
      const t = setTimeout(() => setHint(false), 6000);
      return () => clearTimeout(t);
    }
  }, [remotePresent]);

  /* If the other person leaves, always show yourself full screen again. */
  useEffect(() => {
    if (!remotePresent) setSwapped(false);
  }, [remotePresent]);

  const toggleMic = () => callRef.current?.setLocalAudio(!callRef.current.localAudio());
  const toggleCam = () => callRef.current?.setLocalVideo(!callRef.current.localVideo());
  const flipCamera = () =>
    callRef.current?.cycleCamera({ preferDifferentFacingMode: true }).catch(() => {});
  const leave = () => {
    callRef.current?.leave().catch(() => {});
  };
  const enableSound = () => {
    audioRef.current?.play().then(() => setSoundBlocked(false)).catch(() => {});
  };

  /* Layout: one tile is big (fills the screen), the other is a small floating picture. */
  const localIsBig = !remotePresent || swapped;
  const bigStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 1 };
  const smallStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'max(12px, env(safe-area-inset-top))',
    right: 12,
    width: 'clamp(96px, 28vw, 150px)',
    aspectRatio: '3 / 4',
    zIndex: 3,
    borderRadius: 12,
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.85)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
    cursor: 'pointer',
    background: '#000',
  };

  const localTile = (
    <div
      key="local"
      style={{ ...(localIsBig ? bigStyle : smallStyle), overflow: 'hidden', background: '#000' }}
    >
      {snap.local.video.on ? (
        <VideoSurface track={snap.local.video.track} mirrorIfFront fit={localIsBig ? 'contain' : 'cover'} />
      ) : (
        <Placeholder text="Your camera is off" />
      )}
      <Label text="You" />
    </div>
  );

  const remoteTile = snap.remote ? (
    <div
      key="remote"
      style={{ ...(localIsBig ? smallStyle : bigStyle), overflow: 'hidden', background: '#000' }}
    >
      {snap.remote.video.on ? (
        <VideoSurface track={snap.remote.video.track} fit={localIsBig ? 'cover' : 'contain'} />
      ) : (
        <Placeholder text={`${remoteLabel}'s camera is off`} />
      )}
      <Label text={remoteLabel} />
    </div>
  ) : null;

  // The small picture is the one you tap to swap.
  const onSmallTap = () => setSwapped((s) => !s);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        background: '#000',
        overflow: 'hidden',
        color: '#fff',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        touchAction: 'manipulation',
      }}
    >
      {/* The tap-to-swap button below sits above both tiles. */}
      {localTile}
      {remoteTile}
      {remotePresent && (
        <button
          type="button"
          aria-label="Swap big and small views"
          onClick={onSmallTap}
          style={{
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top))',
            right: 12,
            width: 'clamp(96px, 28vw, 150px)',
            aspectRatio: '3 / 4',
            zIndex: 4,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
          }}
        />
      )}

      <audio ref={audioRef} autoPlay playsInline />

      {/* Status banners */}
      <div
        style={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: 12,
          right: remotePresent ? 'calc(clamp(96px, 28vw, 150px) + 24px)' : 12,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {!connected && <Banner>Connecting…</Banner>}
        {connected && !remotePresent && <Banner>Waiting for the other person to join…</Banner>}
        {notice && <Banner warn>{notice}</Banner>}
        {hint && <Banner>Tap the small picture to swap views</Banner>}
      </div>

      {soundBlocked && (
        <button
          type="button"
          onClick={enableSound}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 6,
            width: 'auto',
            margin: 0,
            padding: '12px 22px',
            borderRadius: 24,
            border: 'none',
            background: accent,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Tap to turn on sound
        </button>
      )}

      {/* Professional's logo, bottom right, just above the controls */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 12,
            bottom: 'calc(max(18px, env(safe-area-inset-bottom)) + 70px)',
            width: 48,
            height: 48,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${accent}`,
            background: '#fff',
            opacity: 0.95,
            zIndex: 4,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 5,
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
          padding: '14px 12px max(18px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0))',
        }}
      >
        <RoundButton label={micOn ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleMic} active={micOn}>
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </RoundButton>
        <RoundButton label={camOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCam} active={camOn}>
          {camOn ? <CamIcon /> : <CamOffIcon />}
        </RoundButton>
        {cameraCount > 1 && (
          <RoundButton label="Flip camera" onClick={flipCamera}>
            <FlipIcon />
          </RoundButton>
        )}
        {remotePresent && (
          <RoundButton label="Swap big and small views" onClick={onSmallTap}>
            <SwapIcon />
          </RoundButton>
        )}
        <RoundButton label="Leave call" onClick={leave} danger>
          <LeaveIcon />
        </RoundButton>
      </div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        bottom: 8,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.55)',
        color: '#fff',
        fontSize: 12,
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}

function Banner({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        padding: '8px 12px',
        borderRadius: 10,
        background: warn ? 'rgba(192,57,43,0.92)' : 'rgba(0,0,0,0.6)',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1.35,
      }}
    >
      {children}
    </div>
  );
}
