import {
  GUEST_BASE_URL,
  GUEST_LINK_HOURS,
  GUEST_ROOM_PREFIX,
  MAX_GUESTS,
  cleanSchool,
  countActiveGuests,
  dailyPost,
  json,
  preflight,
  verifyStation,
} from '@/lib/director-guest';

export async function OPTIONS(req: Request) {
  return preflight(req);
}

// Director "Invite guest": makes a Daily room and returns the guest link.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const school = cleanSchool(body.school);
  if (!school) return json(req, { error: 'bad_station' }, 400);

  if (!(await verifyStation(school, String(body.password || '')))) {
    return json(req, { error: 'bad_login' }, 401);
  }

  if ((await countActiveGuests(school)) >= MAX_GUESTS) {
    return json(req, { error: 'too_many_guests', message: `Up to ${MAX_GUESTS} guests at a time.` }, 409);
  }

  const suffix = Math.random().toString(36).slice(2, 8);
  const roomName = `${GUEST_ROOM_PREFIX}${school}-${suffix}`;

  const res = await dailyPost('/rooms', {
    name: roomName,
    properties: {
      // The link works for 2 hours, and the guest can leave and come back inside that time.
      exp: Math.round(Date.now() / 1000) + GUEST_LINK_HOURS * 60 * 60,
      eject_at_room_exp: true,
      max_participants: 4,
      enable_recording: false,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('Daily create guest room failed:', res.status, JSON.stringify(err));
    return json(req, { error: 'daily_error', message: err.info || 'Could not create the guest room' }, 502);
  }

  return json(req, {
    room: roomName,
    guestUrl: `${GUEST_BASE_URL}/call/${roomName}`,
    expiresInMinutes: GUEST_LINK_HOURS * 60,
  });
}
