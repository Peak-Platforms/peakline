'use client';

// The meeting screen for Peak Link Groups: several people at once, screen sharing,
// and host controls. The 1:1 call screen (CallRoom.tsx) is separate and unchanged.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DailyCall, DailyParticipant, DailyTrackState } from '@daily-co/daily-js';

export type LeftReason = 'left' | 'removed' | 'ended';

type Props = {
  /** Daily room URL to join. */
  roomUrl: string;
  /** Pass issued by our server. Group rooms are private, so this is required. */
  token: string;
  /** True for the room's owner: shows mute, remove and end-for-all. */
  isHost?: boolean;
  /** Name of the room, shown in the top bar. */
  roomName?: string;
  accent?: string;
  logoUrl?: string | null;
  onJoined?: () => void;
  onLeft?: (reason: LeftReason) => void;
  onError?: (message: string) => void;
};

export type Person = {
  id: string;
  name: string;
  local: boolean;
  host: boolean;
  video: MediaStreamTrack | null;
  audio: MediaStreamTrack | null;
  micOn: boolean;
  screen: MediaStreamTrack | null;
  screenAudio: MediaStreamTrack | null;
};

function usable(t: DailyTrackState | undefined): MediaStreamTrack | null {
  if (!t) return null;
  if (t.state !== 'playable' && t.state !== 'interrupted') return null;
  return t.persistentTrack ?? t.track ?? null;
}

function toPerson(p: DailyParticipant): Person {
  const audioState = p.tracks?.audio?.state;
  return {
    id: p.session_id,
    name: p.user_name || (p.local ? 'You' : 'Guest'),
    local: p.local,
    host: !!p.owner,
    video: usable(p.tracks?.video),
    audio: p.local ? null : usable(p.tracks?.audio),
    micOn: !!audioState && audioState !== 'off' && audioState !== 'blocked',
    screen: usable(p.tracks?.screenVideo),
    screenAudio: p.local ? null : usable(p.tracks?.screenAudio),
  };
}

function listPeople(call: DailyCall): Person[] {
  const all = Object.values(call.participants());
  all.sort((a, b) => {
    if (a.local !== b.local) return a.local ? -1 : 1;
    return (a.joined_at?.getTime() ?? 0) - (b.joined_at?.getTime() ?? 0);
  });
  return all.map(toPerson);
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

/** Plays one person's sound. Video elements are always muted; sound comes from these. */
function AudioSink({ track, onBlocked }: { track: MediaStreamTrack; onBlocked: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const blockedRef = useRef(onBlocked);
  blockedRef.current = onBlocked;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = new MediaStream([track]);
    el.play().catch((err) => {
      if (err?.name === 'NotAllowedError') blockedRef.current();
    });
    return () => {
      el.srcObject = null;
    };
  }, [track]);

  return <audio ref={ref} autoPlay playsInline data-peak-audio="" />;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
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
const MicOffIcon = ({ size = 22 }: { size?: number }) => (
  <svg {...iconProps} width={size} height={size}>
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
const ScreenIcon = () => (
  <svg {...iconProps}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4M12 13V8M9.5 10.5L12 8l2.5 2.5" />
  </svg>
);
const PeopleIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2a6.5 6.5 0 0 1 3 5.8" />
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
  highlight,
  badge,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  /** Fill color when the button's feature is switched on (e.g. sharing your screen). */
  highlight?: string;
  badge?: number;
}) {
  const bg = danger ? '#c0392b' : highlight ? highlight : active ? 'rgba(255,255,255,0.16)' : '#fff';
  const color = danger || highlight ? '#fff' : active ? '#fff' : '#161B22';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        position: 'relative',
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
      {typeof badge === 'number' && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            padding: '0 5px',
            borderRadius: 10,
            background: '#fff',
            color: '#161B22',
            fontSize: 12,
            fontWeight: 600,
            lineHeight: '20px',
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ───────── tiles and layout ───────── */

function Tile({
  person,
  speaking,
  accent,
  compact = false,
}: {
  person: Person;
  speaking: boolean;
  accent: string;
  compact?: boolean;
}) {
  const label = person.local ? 'You' : person.name;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        borderRadius: 10,
        overflow: 'hidden',
        background: '#1c2430',
        boxShadow: speaking ? `0 0 0 3px ${accent}` : 'none',
      }}
    >
      {person.video ? (
        <VideoSurface track={person.video} mirrorIfFront={person.local} fit="cover" />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: compact ? 44 : 84,
              height: compact ? 44 : 84,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: compact ? 16 : 30,
              fontWeight: 600,
            }}
          >
            {initials(person.name) || '?'}
          </div>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: 6,
          bottom: 6,
          maxWidth: 'calc(100% - 12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 12,
        }}
      >
        {!person.micOn && <MicOffIcon size={13} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
          {person.host ? ' · Host' : ''}
        </span>
      </div>
    </div>
  );
}

// Picks the number of columns that gives the largest tiles for this many people
// in a box this size, so two people sit side by side on a laptop and stacked on a phone.
function bestColumns(count: number, width: number, height: number): number {
  if (count <= 1 || !width || !height) return 1;
  const ratio = 4 / 3;
  let best = 1;
  let bestWidth = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tileWidth = Math.min(width / cols, (height / rows) * ratio);
    if (tileWidth > bestWidth + 0.5) {
      bestWidth = tileWidth;
      best = cols;
    }
  }
  return best;
}

/**
 * The picture area: everyone in a grid, or, while someone shares their screen,
 * the shared screen large with everyone in a strip underneath.
 */
export function GroupStage({
  people,
  activeId,
  accent,
  onStopShare,
}: {
  people: Person[];
  activeId: string | null;
  accent: string;
  onStopShare?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sharer = people.find((p) => p.screen) || null;

  if (sharer) {
    return (
      <div ref={boxRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
          {sharer.local ? (
            // Showing your own shared screen back to you makes a hall of mirrors.
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                background: '#1c2430',
                color: 'rgba(255,255,255,0.85)',
                fontSize: 15,
                textAlign: 'center',
                padding: 16,
              }}
            >
              You are sharing your screen
              {onStopShare && (
                <button
                  type="button"
                  onClick={onStopShare}
                  style={{
                    width: 'auto',
                    margin: 0,
                    padding: '10px 20px',
                    borderRadius: 22,
                    border: 'none',
                    background: accent,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Stop sharing
                </button>
              )}
            </div>
          ) : (
            <>
              <VideoSurface track={sharer.screen} fit="contain" />
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 8,
                  padding: '3px 10px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                {sharer.name}'s screen
              </div>
            </>
          )}
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, overflowX: 'auto', height: 96 }}>
          {people.map((p) => (
            <div key={p.id} style={{ flex: '0 0 128px', height: '100%' }}>
              <Tile person={p} speaking={p.id === activeId && people.length > 2} accent={accent} compact />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cols = bestColumns(people.length, size.w, size.h);
  const rows = Math.max(1, Math.ceil(people.length / cols));

  return (
    <div
      ref={boxRef}
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: 8,
        padding: 8,
      }}
    >
      {people.map((p) => (
        <Tile key={p.id} person={p} speaking={p.id === activeId && people.length > 2} accent={accent} />
      ))}
    </div>
  );
}

/** The list of who is here. For the host it also carries mute, remove and end-for-all. */
export function PeoplePanel({
  people,
  isHost,
  onClose,
  onMute,
  onMuteAll,
  onRemove,
  onEndAll,
}: {
  people: Person[];
  isHost: boolean;
  onClose: () => void;
  onMute: (id: string) => void;
  onMuteAll: () => void;
  onRemove: (id: string) => void;
  onEndAll: () => void;
}) {
  // Removing someone, or ending the meeting, takes a second tap to confirm.
  const [confirm, setConfirm] = useState('');
  const others = people.filter((p) => !p.local);

  const small: React.CSSProperties = {
    width: 'auto',
    margin: 0,
    padding: '6px 12px',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent',
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    flex: '0 0 auto',
  };

  return (
    <div
      role="dialog"
      aria-label="People in this meeting"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(340px, 100%)',
        zIndex: 8,
        display: 'flex',
        flexDirection: 'column',
        background: '#161B22',
        borderLeft: '1px solid rgba(255,255,255,0.12)',
        color: '#fff',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>People ({people.length})</div>
        <button type="button" onClick={onClose} style={small}>
          Close
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px' }}>
        {people.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
                {p.local ? ' (you)' : ''}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                {p.host ? 'Host · ' : ''}
                {p.micOn ? 'Mic on' : 'Muted'}
              </div>
            </div>
            {isHost && !p.local && (
              <>
                {p.micOn && (
                  <button type="button" onClick={() => onMute(p.id)} style={small}>
                    Mute
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm === p.id) {
                      setConfirm('');
                      onRemove(p.id);
                    } else {
                      setConfirm(p.id);
                    }
                  }}
                  style={{
                    ...small,
                    ...(confirm === p.id ? { background: '#c0392b', borderColor: '#c0392b' } : {}),
                  }}
                >
                  {confirm === p.id ? 'Tap again to remove' : 'Remove'}
                </button>
              </>
            )}
          </div>
        ))}
        {people.length <= 1 && (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '14px 0' }}>
            Nobody else is here yet.
          </p>
        )}
      </div>

      {isHost && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {others.some((p) => p.micOn) && (
            <button type="button" onClick={onMuteAll} style={{ ...small, padding: '10px 12px', borderRadius: 8 }}>
              Mute everyone
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm === 'end') {
                setConfirm('');
                onEndAll();
              } else {
                setConfirm('end');
              }
            }}
            style={{
              ...small,
              padding: '10px 12px',
              borderRadius: 8,
              background: confirm === 'end' ? '#c0392b' : 'transparent',
              borderColor: '#c0392b',
              color: confirm === 'end' ? '#fff' : '#ff8a7a',
            }}
          >
            {confirm === 'end' ? 'Tap again to end the meeting for everyone' : 'End meeting for everyone'}
          </button>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.4 }}>
            People you mute can turn their own microphone back on.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────── main component ───────── */

export default function GroupRoom({
  roomUrl,
  token,
  isHost = false,
  roomName,
  accent = '#F2A93B',
  logoUrl = null,
  onJoined,
  onLeft,
  onError,
}: Props) {
  const callRef = useRef<DailyCall | null>(null);
  const cbRef = useRef({ onJoined, onLeft, onError });
  cbRef.current = { onJoined, onLeft, onError };
  // Why the call ended, and a guard so the page is only told once.
  const reasonRef = useRef<LeftReason>('left');
  const finishedRef = useRef(false);

  const [connected, setConnected] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [cameraCount, setCameraCount] = useState(0);
  const [canShare, setCanShare] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [notice, setNotice] = useState('');
  const [soundBlocked, setSoundBlocked] = useState(false);

  const refresh = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    setPeople(listPeople(call));
    setMicOn(call.localAudio());
    setCamOn(call.localVideo());
  }, []);

  /* Create the call object and join. Depends only on the room URL and pass. */
  useEffect(() => {
    let cancelled = false;
    let call: DailyCall | null = null;
    finishedRef.current = false;
    reasonRef.current = 'left';

    const finishWithError = (message: string) => {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      cbRef.current.onError?.(message);
    };
    const finishLeft = () => {
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;
      cbRef.current.onLeft?.(reasonRef.current);
    };
    const describe = (e: any): string => {
      const type = e?.error?.type;
      if (type === 'meeting-full') return 'This meeting is full.';
      if (type === 'exp-token' || type === 'exp-room') return 'Your pass into this meeting has expired. Join again.';
      return typeof e?.errorMsg === 'string' && e.errorMsg ? e.errorMsg : "Couldn't connect. You can try again.";
    };

    (async () => {
      try {
        const Daily = (await import('@daily-co/daily-js')).default;
        if (cancelled) return;

        // Only one Daily instance may exist at a time (also guards React dev double-mount).
        const existing = Daily.getCallInstance();
        if (existing) await existing.destroy();
        if (cancelled) return;

        const browser = Daily.supportedBrowser();
        setCanShare(!!browser.supportsScreenShare);
        setIsMobile(!!browser.mobile);

        call = Daily.createCallObject();
        callRef.current = call;

        const onChange = () => refresh();
        call.on('participant-joined', onChange);
        call.on('participant-updated', onChange);
        call.on('participant-left', onChange);
        call.on('joined-meeting', onChange);
        call.on('active-speaker-change', (e) => {
          setActiveId(e?.activeSpeaker?.peerId ?? null);
        });
        call.on('camera-error', () => {
          setNotice('Camera or microphone is blocked. Check your browser permissions, then rejoin.');
        });
        call.on('error', (e: any) => {
          if (e?.error?.type === 'ejected') {
            // Removed by the host, the host ended the meeting, or the session ceiling was reached.
            if (reasonRef.current === 'left') reasonRef.current = 'removed';
            finishLeft();
            return;
          }
          finishWithError(describe(e));
        });
        call.on('left-meeting', () => finishLeft());

        await call.join({ url: roomUrl, token });
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
        finishWithError(describe(err));
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
  }, [roomUrl, token, refresh]);

  const me = people.find((p) => p.local) || null;
  const sharing = !!me?.screen;
  const someoneElseSharing = people.some((p) => !p.local && p.screen);

  const toggleMic = () => callRef.current?.setLocalAudio(!callRef.current.localAudio());
  const toggleCam = () => callRef.current?.setLocalVideo(!callRef.current.localVideo());
  const flipCamera = () =>
    callRef.current?.cycleCamera({ preferDifferentFacingMode: true }).catch(() => {});
  const toggleShare = () => {
    const call = callRef.current;
    if (!call) return;
    if (sharing) {
      call.stopScreenShare();
    } else if (someoneElseSharing) {
      setNotice('Someone is already sharing. Ask them to stop first.');
      setTimeout(() => setNotice(''), 4000);
    } else {
      call.startScreenShare();
    }
  };
  const leave = () => {
    callRef.current?.leave().catch(() => {});
  };
  const mute = (id: string) => callRef.current?.updateParticipant(id, { setAudio: false });
  const muteAll = () => callRef.current?.updateParticipants({ '*': { setAudio: false } });
  const remove = (id: string) => callRef.current?.updateParticipant(id, { eject: true });
  const endAll = () => {
    const call = callRef.current;
    if (!call) return;
    reasonRef.current = 'ended';
    call.updateParticipants({ '*': { eject: true } });
    // Give the removals a moment to go out before this side hangs up.
    setTimeout(() => call.leave().catch(() => {}), 400);
  };
  const enableSound = () => {
    document.querySelectorAll<HTMLAudioElement>('audio[data-peak-audio]').forEach((el) => {
      el.play().catch(() => {});
    });
    setSoundBlocked(false);
  };

  const alone = connected && people.length <= 1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d1117',
        overflow: 'hidden',
        color: '#fff',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        touchAction: 'manipulation',
      }}
    >
      {/* Top bar: room name and status */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 'max(10px, env(safe-area-inset-top)) 12px 2px',
          minHeight: 40,
        }}
      >
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${accent}`,
              background: '#fff',
              flex: '0 0 auto',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {roomName && (
            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {roomName}
            </div>
          )}
          <div style={{ fontSize: 12, color: notice ? '#ff8a7a' : 'rgba(255,255,255,0.6)' }}>
            {notice
              ? notice
              : !connected
                ? 'Connecting…'
                : alone
                  ? isHost
                    ? 'You are the only one here. Others can join now.'
                    : 'Waiting for others to join…'
                  : `${people.length} people in this meeting`}
          </div>
        </div>
      </div>

      <GroupStage people={people} activeId={activeId} accent={accent} onStopShare={toggleShare} />

      {people.map((p) => (p.audio ? <AudioSink key={p.id + '-a'} track={p.audio} onBlocked={() => setSoundBlocked(true)} /> : null))}
      {people.map((p) =>
        p.screenAudio ? <AudioSink key={p.id + '-s'} track={p.screenAudio} onBlocked={() => setSoundBlocked(true)} /> : null
      )}

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

      {showPeople && (
        <PeoplePanel
          people={people}
          isHost={isHost}
          onClose={() => setShowPeople(false)}
          onMute={mute}
          onMuteAll={muteAll}
          onRemove={remove}
          onEndAll={endAll}
        />
      )}

      {/* Controls */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          padding: '8px 12px max(14px, env(safe-area-inset-bottom))',
        }}
      >
        <RoundButton label={micOn ? 'Mute microphone' : 'Unmute microphone'} onClick={toggleMic} active={micOn}>
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </RoundButton>
        <RoundButton label={camOn ? 'Turn camera off' : 'Turn camera on'} onClick={toggleCam} active={camOn}>
          {camOn ? <CamIcon /> : <CamOffIcon />}
        </RoundButton>
        {isMobile && cameraCount > 1 && (
          <RoundButton label="Flip camera" onClick={flipCamera}>
            <FlipIcon />
          </RoundButton>
        )}
        {canShare && (
          <RoundButton
            label={sharing ? 'Stop sharing your screen' : 'Share your screen'}
            onClick={toggleShare}
            highlight={sharing ? accent : undefined}
          >
            <ScreenIcon />
          </RoundButton>
        )}
        <RoundButton label="People" onClick={() => setShowPeople((s) => !s)} badge={people.length || undefined}>
          <PeopleIcon />
        </RoundButton>
        <RoundButton label="Leave meeting" onClick={leave} danger>
          <LeaveIcon />
        </RoundButton>
      </div>
    </div>
  );
}
