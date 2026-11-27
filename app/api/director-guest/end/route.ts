import {
  cleanSchool,
  dailyDelete,
  dailyPost,
  json,
  parseGuestRoom,
  preflight,
  verifyStation,
} from '@/lib/director-guest';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

// Director "End guest": stops the stream, then deletes the room so the link stops working.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const school = cleanSchool(body.school);
  if (!school) return json(req, { error: 'bad_station' }, 400);

  if (!(await verifyStation(school, String(body.password || '')))) {
    return json(req, { error: 'bad_login' }, 401);
  }

  if (!parseGuestRoom(body.room, school)) return json(req, { error: 'bad_room' }, 400);
  const room = String(body.room);

  // Both steps are best effort: a stream that already stopped or a room that is already gone is fine.
  await dailyPost(`/rooms/${room}/live-streaming/stop`).catch(() => {});
  await dailyDelete(`/rooms/${room}`).catch(() => {});

  return json(req, { ok: true });
}
