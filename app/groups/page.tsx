'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Room = { id: string; name: string; slug: string; max_participants: number; host_key: string | null; created_at: string };

export default function GroupsPage() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxRooms, setMaxRooms] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState('');
  // Deleting, and resetting the staff link, each take a second tap to confirm.
  const [confirmDelete, setConfirmDelete] = useState('');
  const [confirmReset, setConfirmReset] = useState('');
  const [origin, setOrigin] = useState('');
  const router = useRouter();

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      try {
        const res = await fetch('/api/groups');
        if (res.status === 401) { router.push('/login'); return; }
        const data = await res.json();
        setEnabled(!!data.enabled);
        setMaxRooms(data.maxRooms || 0);
        setMaxParticipants(data.maxParticipants || 0);
        setRooms(data.rooms || []);
      } catch {
        setStatus('Could not load your group rooms. Reload the page to try again.');
      }
      setLoading(false);
    })();
  }, []);

  const linkFor = (slug: string) => `${origin}/meet/${slug}`;

  async function createRoom() {
    setStatus('');
    if (!name.trim()) { setStatus('Give the room a name first.'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || 'Could not create the room.');
      } else {
        setRooms([...rooms, data.room]);
        setName('');
      }
    } catch {
      setStatus('Network error creating the room.');
    }
    setCreating(false);
  }

  async function deleteRoom(room: Room) {
    if (confirmDelete !== room.id) { setConfirmDelete(room.id); return; }
    setConfirmDelete('');
    setStatus('');
    try {
      const res = await fetch(`/api/groups/${room.slug}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.message || 'Could not delete the room.');
        return;
      }
      setRooms(rooms.filter((r) => r.id !== room.id));
    } catch {
      setStatus('Network error deleting the room.');
    }
  }

  function copyLink(room: Room) {
    navigator.clipboard.writeText(linkFor(room.slug));
    setCopiedId(room.id);
    setTimeout(() => setCopiedId(''), 1800);
  }

  const staffLinkFor = (room: Room) => `${linkFor(room.slug)}?host=${room.host_key}`;

  function copyStaffLink(room: Room) {
    navigator.clipboard.writeText(staffLinkFor(room));
    setCopiedId(room.id + '-staff');
    setTimeout(() => setCopiedId(''), 1800);
  }

  // Makes a new staff link. The old one stops working straight away.
  async function resetStaffLink(room: Room) {
    if (room.host_key && confirmReset !== room.id) { setConfirmReset(room.id); return; }
    setConfirmReset('');
    setStatus('');
    try {
      const res = await fetch(`/api/groups/${room.slug}/host-key`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.hostKey) {
        setStatus(data.message || 'Could not reset the staff link.');
        return;
      }
      setRooms(rooms.map((r) => (r.id === room.id ? { ...r, host_key: data.hostKey } : r)));
    } catch {
      setStatus('Network error resetting the staff link.');
    }
  }

  const canCreate = enabled && rooms.length < maxRooms;

  return (
    <div className="wrap">
      <div className="brand-row">
        <video autoPlay muted loop playsInline className="brand-video">
          <source src="https://storage.googleapis.com/xsenassets/peak%20platforms.mp4" type="video/mp4" />
        </video>
        <h1 className="brand-title">Peak Link</h1>
      </div>

      <h2 className="page-title">Group rooms</h2>
      <p className="lede">
        A standing meeting room with one permanent link. Anyone you send it to joins from their
        browser, no account needed.
      </p>
      <p className="usage"><Link href="/dashboard" className="nav-link">← Back to dashboard</Link></p>

      {loading ? (
        <p className="empty">Loading…</p>
      ) : !enabled ? (
        <div className="note">
          <h2 className="upgrade-title">Groups isn't turned on for this account yet</h2>
          <p className="hint" style={{ margin: 0 }}>
            Group rooms hold meetings with several people at once, with screen sharing and host
            controls. Your one-to-one links work as usual in the meantime.
          </p>
        </div>
      ) : (
        <>
          {rooms.map((room) => (
            <div className="note client-link-card" key={room.id}>
              <div className="client-link-header">
                <span className="name">{room.name}</span>
                <span className="badge-active">Up to {room.max_participants} people</span>
              </div>
              <div className="result" style={{ marginTop: 10, paddingTop: 12 }}>
                <div className="link">{linkFor(room.slug)}</div>
                {copiedId === room.id && <div className="toast">Copied</div>}
              </div>
              <button onClick={() => router.push(`/meet/${room.slug}`)}>Start meeting</button>
              <button className="secondary" onClick={() => copyLink(room)}>Copy guest link</button>

              <div className="result" style={{ marginTop: 18, paddingTop: 14 }}>
                <p className="hint">
                  <strong>Staff link.</strong> Anyone with this link can start a meeting and has host
                  controls. Give it only to your own team.
                </p>
                {room.host_key ? (
                  <>
                    <div className="link">{staffLinkFor(room)}</div>
                    {copiedId === room.id + '-staff' && <div className="toast">Copied</div>}
                  </>
                ) : (
                  <p className="hint">This room doesn't have a staff link yet.</p>
                )}
              </div>
              {room.host_key && (
                <button className="secondary" onClick={() => copyStaffLink(room)}>Copy staff link</button>
              )}
              <button className="secondary" onClick={() => resetStaffLink(room)}>
                {!room.host_key
                  ? 'Create staff link'
                  : confirmReset === room.id
                    ? 'Tap again: the current staff link will stop working'
                    : 'Reset staff link'}
              </button>

              <button className="secondary" onClick={() => deleteRoom(room)}>
                {confirmDelete === room.id ? 'Tap again to delete this room and its link' : 'Delete room'}
              </button>
            </div>
          ))}

          {rooms.length > 0 && (
            <p className="mode-hint" style={{ marginTop: 14 }}>
              Guests are let in once you or someone with the staff link has started the meeting, and
              wait on the guest link until then.
              Each person can stay up to 6 hours. Group meetings are encrypted in transit and pass
              through our video provider's servers; they are not end-to-end encrypted the way
              one-to-one calls are.
            </p>
          )}

          {canCreate && (
            <div className="note" style={{ marginTop: 14 }}>
              <label>Room name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your business or team name"
                maxLength={60}
              />
              <p className="mode-hint" style={{ marginTop: 8, marginBottom: 0 }}>
                Guests see this name when they open the link. Up to {maxParticipants} people per meeting.
              </p>
              <button onClick={createRoom} disabled={creating}>
                {creating ? 'Creating…' : 'Create group room'}
              </button>
            </div>
          )}

          <div id="status">{status}</div>
        </>
      )}
    </div>
  );
}
