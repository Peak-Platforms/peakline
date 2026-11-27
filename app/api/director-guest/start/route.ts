import {
  GUEST_LINK_HOURS,
  RTMP_INGEST_BASE,
  cleanSchool,
  dailyGet,
  dailyPost,
  json,
  parseGuestRoom,
  preflight,
  streamKeyFor,
  verifyStation,
} from '@/lib/director-guest';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

// Sends the guest's picture and sound to the station. The Director calls this repeatedly
// until the guest has joined, and again after a guest drops and rejoins.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const school = cleanSchool(body.school);
  if (!school) return json(req, { error: 'bad_station' }, 400);

  if (!(await verifyStation(school, String(body.password || '')))) {
    return json(req, { error: 'bad_login' }, 401);
  }

  const parsed = parseGuestRoom(body.room, school);
  if (!parsed) return json(req, { error: 'bad_room' }, 400);
  const room = String(body.room);

  // Who is in the room right now?
  const presence = await dailyGet(`/rooms/${room}/presence`);
  if (presence.status === 404) return json(req, { error: 'room_gone' }, 404);
  if (!presence.ok) return json(req, { error: 'daily_error' }, 502);
  const people = ((await presence.json().catch(() => ({}))).data || []) as any[];

  // Newest arrival wins, so a guest who rejoins is picked up automatically.
  const guest = people.sort((a, b) => (b.joinTime || '').localeCompare(a.joinTime || ''))[0];
  if (!guest?.id) return json(req, { error: 'guest_not_here' }, 409);

  const key = streamKeyFor(school, parsed.suffix);

  // If a stream is already running (guest rejoined), stop it first. Errors here are fine.
  await dailyPost(`/rooms/${room}/live-streaming/stop`).catch(() => {});

  const res = await dailyPost(`/rooms/${room}/live-streaming/start`, {
    rtmpUrl: `${RTMP_INGEST_BASE}/${key}`,
    width: 854,
    height: 480,
    fps: 24,
    videoBitrate: 1000,
    audioBitrate: 64,
    maxDuration: GUEST_LINK_HOURS * 60 * 60,
    layout: { preset: 'single-participant', session_id: guest.id },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Daily start stream failed:', res.status, JSON.stringify(err));
    return json(req, { error: 'daily_error', message: err.info || 'Could not start the stream' }, 502);
  }

  return json(req, { ok: true, streamKey: key });
}
